from extract import get_custom_format, get_regex
import re
import sys

# ANSI escape codes for colors
GREEN = '\033[92m'
RED = '\033[91m'
RESET = '\033[0m'

def utr(debug_level=0):
    # Define good and bad matches for Radarr and Sonarr
    radarr_good_matches = [
        "Brigsby Bear (2017) (1080p BluRay x265 SDR AAC 5.1 English - Tigole UTR)",
        "Risky Business (1983) (1080p BluRay x265 SDR AAC 5.1 English - FreetheFish UTR)",
        "Labyrinth (1986) 30th Anniversary (1080p BluRay x265 SDR AAC 7.1 English - Tigole UTR)",
        "Love Actually (2003) (1080p BluRay x265 SDR AAC 5.1 English - Tigole UTR)"
    ]
    radarr_bad_matches = [
        "Eva.Soda.Utroskab.med.den.første.kvinde.i.bilen.Sex.i.bilen.6462a7a8a5d9e.",
        "Outrage.1950.1080p.BluRay.Flac.2.0.x265.HEVC-Nb8.mkv",
        "Utro 1966 DANiSH 720p WEB-DL H 264 AAC2 0-TWA"
    ]
    sonarr_good_matches = [
        "The Simpsons (1989) S07 (480p DVD x265 SDR AAC 5.1 English - ImE UTR)",
        "The Simpsons (1989) S14 (1080p BluRay x265 SDR AAC 5.1 English - ImE UTR)"
    ]
    sonarr_bad_matches = [
        "The.Outreau.Case.A.French.Nightmare.S01E01.The.Renard.Block.1080p.NF.WEB-DL.DDP5.1.H.264-NTb.mkv",
        "The.Outreau.Case.A.French.Nightmare.S01.1080p.NF.WEB-DL.DDP5.1.H.264-NTb"
    ]

    # Get the custom formats for "qxr" from both Radarr and Sonarr
    qxr_radarr = get_custom_format("qxr", "radarr", debug_level)
    qxr_sonarr = get_custom_format("qxr", "sonarr", debug_level)

    # Extract the regex values for both Radarr and Sonarr using get_regex
    UTR_value_radarr = get_regex(qxr_radarr, "UTR (Title)", debug_level)
    UTR_value_sonarr = get_regex(qxr_sonarr, "UTR (Title)", debug_level)

    # Replace the negative lookbehind with a negative lookahead if necessary
    UTR_value_radarr = UTR_value_radarr.replace("(?<=^|[\\s.-])", "(?:^|[\\s.-])")
    UTR_value_sonarr = UTR_value_sonarr.replace("(?<=^|[\\s.-])", "(?:^|[\\s.-])")

    if debug_level > 0:
        print(f"Testing with regex: {UTR_value_radarr}")

    # Compare Radarr and Sonarr qxr regex values
    if UTR_value_radarr != UTR_value_sonarr:
        print("Test Failed: regex value not same.")
        print(f"Radarr regex: {UTR_value_radarr}")
        print(f"Sonarr regex: {UTR_value_sonarr}")
        sys.exit(1)

    failed_good_matches = []
    failed_bad_matches = []

    # Print Radarr Good Matches
    print("\nRadarr Releases:")
    print("----------------")
    print("Should Match:")
    for term in radarr_good_matches:
        if re.search(UTR_value_radarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_good_matches.append(("Radarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Print Radarr Bad Matches
    print("\nShould NOT Match:")
    for term in radarr_bad_matches:
        if not re.search(UTR_value_radarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_bad_matches.append(("Radarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Print Sonarr Good Matches
    print("\nSonarr Releases:")
    print("----------------")
    print("Should Match:")
    for term in sonarr_good_matches:
        if re.search(UTR_value_sonarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_good_matches.append(("Sonarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Print Sonarr Bad Matches
    print("\nShould NOT Match:")
    for term in sonarr_bad_matches:
        if not re.search(UTR_value_sonarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_bad_matches.append(("Sonarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Determine and print overall test result
    if not failed_good_matches and not failed_bad_matches:
        return True
    else:
        return False