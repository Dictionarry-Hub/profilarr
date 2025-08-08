"""Profile import strategy."""
import logging
from typing import Dict, List, Any, Set
from .base import ImportStrategy
from ..utils import load_yaml, extract_format_names, generate_language_formats
from ..compiler import compile_format_to_api_structure, compile_profile_to_api_structure

logger = logging.getLogger(__name__)


class ProfileStrategy(ImportStrategy):
    """Strategy for importing quality profiles."""
    
    def compile(self, filenames: List[str]) -> Dict[str, Any]:
        """
        Compile profile files and their dependent formats to API-ready format.
        
        Args:
            filenames: List of profile filenames (without .yml)
            
        Returns:
            Dictionary with 'profiles' and 'formats' keys
        """
        profiles = []
        all_formats = []
        processed_formats: Set[str] = set()
        # Cache for language formats to avoid recompiling
        language_formats_cache: Dict[str, List[Dict]] = {}
        
        # Track compilation stats
        total_formats = 0
        compiled_formats = 0
        failed_formats = []
        
        logger.info(f"Starting compilation of {len(filenames)} profiles")
        
        for filename in filenames:
            try:
                # Load profile YAML
                profile_yaml = load_yaml(f"profile/{filename}.yml")
                
                # Extract referenced custom formats
                format_names = extract_format_names(profile_yaml)
                total_formats += len(format_names)
                
                for j, format_name in enumerate(format_names, 1):
                    # Skip if already processed
                    display_name = self.add_unique_suffix(format_name) if self.import_as_unique else format_name
                    if display_name in processed_formats:
                        continue
                    
                    logger.debug(f"[COMPILE] Compiling format {format_name} ({j}/{len(format_names)})")
                    
                    try:
                        format_yaml = load_yaml(f"custom_format/{format_name}.yml")
                        compiled_format = compile_format_to_api_structure(format_yaml, self.arr_type)
                        
                        if self.import_as_unique:
                            compiled_format['name'] = self.add_unique_suffix(compiled_format['name'])
                        
                        all_formats.append(compiled_format)
                        processed_formats.add(compiled_format['name'])
                        compiled_formats += 1
                        
                    except Exception as e:
                        logger.warning(f"Could not load format {format_name}: {e}")
                        failed_formats.append(format_name)
                
                # Generate language formats if needed
                language = profile_yaml.get('language', 'any')
                if language != 'any' and '_' in language:
                    # Check cache first
                    if language not in language_formats_cache:
                        logger.debug(f"[COMPILE] Generating language formats for {language} (first time)")
                        language_formats = generate_language_formats(language, self.arr_type)
                        compiled_langs = []
                        
                        for lang_format in language_formats:
                            logger.debug(f"[COMPILE] Compiling language format: {lang_format.get('name', 'Unknown')}")
                            compiled_lang = compile_format_to_api_structure(lang_format, self.arr_type)
                            
                            if self.import_as_unique:
                                compiled_lang['name'] = self.add_unique_suffix(compiled_lang['name'])
                            
                            compiled_langs.append(compiled_lang)
                            
                            # Add to all_formats only on first compilation
                            if compiled_lang['name'] not in processed_formats:
                                all_formats.append(compiled_lang)
                                processed_formats.add(compiled_lang['name'])
                                compiled_formats += 1
                                logger.debug(f"Added language format: {compiled_lang['name']} to import list")
                        
                        # Store in cache
                        language_formats_cache[language] = compiled_langs
                    else:
                        logger.debug(f"[COMPILE] Using cached language formats for {language} - already in import list")
                
                # Compile profile
                compiled_profile = compile_profile_to_api_structure(profile_yaml, self.arr_type)
                
                if self.import_as_unique:
                    compiled_profile['name'] = self.add_unique_suffix(compiled_profile['name'])
                    
                    # Update format references in profile
                    for item in compiled_profile.get('formatItems', []):
                        item['name'] = self.add_unique_suffix(item['name'])
                
                profiles.append(compiled_profile)
                logger.debug(f"Compiled profile: {compiled_profile['name']}")
                
            except Exception as e:
                logger.error(f"Failed to compile profile {filename}: {str(e)}", exc_info=True)
        
        # Log compilation summary
        logger.info(f"Compilation complete: {len(profiles)} profiles, {compiled_formats} formats compiled")
        if failed_formats:
            logger.warning(f"Failed to compile {len(failed_formats)} formats: {', '.join(failed_formats[:5])}{'...' if len(failed_formats) > 5 else ''}")
        
        return {
            'profiles': profiles,
            'formats': all_formats
        }
    
    def import_data(self, compiled_data: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
        """
        Import compiled profiles and formats to Arr instance.
        
        Args:
            compiled_data: Dictionary with 'profiles' and 'formats' keys
            dry_run: If True, simulate import without making changes
            
        Returns:
            Import results
        """
        results = {
            'added': 0,
            'updated': 0,
            'failed': 0,
            'details': []
        }
        
        # Import formats first
        if compiled_data['formats']:
            logger.info(f"Importing {len(compiled_data['formats'])} formats to {self.arr_type}")
            
            existing_formats = self.arr.get_all_formats()
            format_map = {f['name']: f['id'] for f in existing_formats}
            
            formats_added = 0
            formats_updated = 0
            formats_failed = []
            
            for format_data in compiled_data['formats']:
                format_name = format_data['name']
                
                try:
                    if format_name in format_map:
                        # Update existing
                        if dry_run:
                            logger.debug(f"[DRY RUN] Would update format: {format_name}")
                        else:
                            format_data['id'] = format_map[format_name]
                            self.arr.put(
                                f"/api/v3/customformat/{format_map[format_name]}",
                                format_data
                            )
                            logger.debug(f"Updated format: {format_name}")
                            formats_updated += 1
                    else:
                        # Add new
                        if dry_run:
                            logger.debug(f"[DRY RUN] Would add format: {format_name}")
                            # In dry run, pretend we got an ID  
                            # Use a predictable fake ID for dry run
                            fake_id = 999000 + len(format_map)
                            format_map[format_name] = fake_id
                        else:
                            response = self.arr.post("/api/v3/customformat", format_data)
                            format_map[format_name] = response['id']
                            logger.debug(f"Added format: {format_name}")
                            formats_added += 1
                        
                except Exception as e:
                    logger.error(f"Failed to import format {format_name}: {e}")
                    formats_failed.append(format_name)
            
            # Log format import summary
            if formats_added or formats_updated:
                logger.info(f"Formats: {formats_added} added, {formats_updated} updated")
            if formats_failed:
                logger.warning(f"Failed to import {len(formats_failed)} formats: {', '.join(formats_failed[:3])}{'...' if len(formats_failed) > 3 else ''}")
        
        # Refresh format map for profile syncing (MUST be done after importing formats)
        if not dry_run:
            # In real mode, get the actual current formats from the server
            existing_formats = self.arr.get_all_formats()
            format_map = {f['name']: f['id'] for f in existing_formats}
        # In dry run mode, format_map already has fake IDs from above
        
        # Sync format IDs in profiles
        for profile in compiled_data['profiles']:
            synced_items = []
            processed_formats = set()
            
            # First add all explicitly defined formats with their scores
            for item in profile.get('formatItems', []):
                if item['name'] in format_map:
                    synced_items.append({
                        'format': format_map[item['name']],
                        'name': item['name'],
                        'score': item.get('score', 0)
                    })
                    processed_formats.add(item['name'])
                else:
                    logger.warning(f"Format {item['name']} not found for profile {profile['name']}")
            
            # Then add ALL other existing formats with score 0 (Arr requirement)
            for format_name, format_id in format_map.items():
                if format_name not in processed_formats:
                    synced_items.append({
                        'format': format_id,
                        'name': format_name,
                        'score': 0
                    })
            
            profile['formatItems'] = synced_items
        
        # Import profiles
        existing_profiles = self.arr.get_all_profiles()
        profile_map = {p['name']: p['id'] for p in existing_profiles}
        
        profile_names_updated = []
        profile_names_added = []
        
        for profile_data in compiled_data['profiles']:
            profile_name = profile_data['name']
            
            try:
                if profile_name in profile_map:
                    # Update existing
                    if dry_run:
                        logger.debug(f"[DRY RUN] Would update profile: {profile_name}")
                    else:
                        profile_data['id'] = profile_map[profile_name]
                        self.arr.put(
                            f"/api/v3/qualityprofile/{profile_data['id']}",
                            profile_data
                        )
                        logger.debug(f"Updated profile: {profile_name}")
                        profile_names_updated.append(profile_name)
                    
                    results['updated'] += 1
                    results['details'].append({
                        'name': profile_name,
                        'action': 'updated'
                    })
                else:
                    # Add new
                    if dry_run:
                        logger.debug(f"[DRY RUN] Would add profile: {profile_name}")
                    else:
                        self.arr.post("/api/v3/qualityprofile", profile_data)
                        logger.debug(f"Added profile: {profile_name}")
                        profile_names_added.append(profile_name)
                    
                    results['added'] += 1
                    results['details'].append({
                        'name': profile_name,
                        'action': 'added'
                    })
                    
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'name': profile_name,
                    'action': 'failed',
                    'error': str(e)
                })
                logger.error(f"Failed to import profile {profile_name}: {e}")
        
        # Log profile import summary
        if profile_names_added:
            logger.info(f"Added {len(profile_names_added)} profiles: {', '.join(profile_names_added)}")
        if profile_names_updated:
            logger.info(f"Updated {len(profile_names_updated)} profiles: {', '.join(profile_names_updated)}")
        
        return results