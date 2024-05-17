from extract import get_custom_format, get_regex
import re

# ANSI escape codes for colors
GREEN = '\033[92m'
RED = '\033[91m'
RESET = '\033[0m'

def amzn(debug_level=0):
    # Get the custom formats for "Amazon Prime (H264)" from both Radarr and Sonarr
    amzn_radarr = get_custom_format("Amazon Prime (H264)", "radarr", debug_level)
    amzn_sonarr = get_custom_format("Amazon Prime (H264)", "sonarr", debug_level)

    # Extract the regex values for both Radarr and Sonarr using get_regex
    amzn_regex_radarr = get_regex(amzn_radarr, "Amazon Prime", debug_level)
    amzn_regex_sonarr = get_regex(amzn_sonarr, "Amazon Prime", debug_level)

    # Check if CFs are the same
    if amzn_regex_radarr != amzn_regex_sonarr:
        print("Different custom formats detected!")
        print("----------------")
        print(f"Radarr: {amzn_regex_radarr}")
        print(f"Sonarr: {amzn_regex_sonarr}")
        return False

    amzn_regex = amzn_regex_radarr
    hevc_regex = get_regex(amzn_radarr, "HEVC", debug_level)
    ds4k_regex = get_regex(amzn_radarr, "DS4K", debug_level)

    if debug_level > 0:
        print(f"Must match : {amzn_regex}")
        print(f"Must NOT match : {hevc_regex}")
        print(f"Must NOT match : {ds4k_regex}")

    # Specify the encoding when opening the files and populate the lists
    radarr_good_matches = []
    with open('tests/cases/amzn_radarr_good.txt', 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('- H.264') or line.lower().startswith('torrent: '):
                radarr_good_matches.append(line.strip())

    radarr_bad_matches = []
    with open('tests/cases/amzn_radarr_bad.txt', 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('- H.264') or line.lower().startswith('torrent: '):
                radarr_bad_matches.append(line.strip())

    sonarr_good_matches = []
    with open('tests/cases/amzn_sonarr_good.txt', 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('- H.264') or line.lower().startswith('torrent: '):
                sonarr_good_matches.append(line.strip())

    sonarr_bad_matches = []
    with open('tests/cases/amzn_sonarr_bad.txt', 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('- H.264') or line.lower().startswith('torrent: '):
                sonarr_bad_matches.append(line.strip())

    hevc_matches = []
    with open('tests/cases/amzn_hevc.txt', 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('- H.264') or line.lower().startswith('torrent: '):
                hevc_matches.append(line.strip())

    ds4k_matches = []
    with open('tests/cases/amzn_ds4k.txt', 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('- H.264') or line.lower().startswith('torrent: '):
                ds4k_matches.append(line.strip())

    failed_good_matches = []
    failed_bad_matches = []

    # Testing Radarr good matches
    print("\nTesting Radarr good matches:\n")
    for term in radarr_good_matches:
        if not re.search(amzn_regex, term, re.IGNORECASE) or re.search(hevc_regex, term, re.IGNORECASE) or re.search(ds4k_regex, term, re.IGNORECASE):
            if re.search(hevc_regex, term, re.IGNORECASE):
                failed_good_matches.append(("Radarr", term, "HEVC"))
                print(f"  - {term}: {RED}Failed (HEVC regex){RESET}")
            elif re.search(ds4k_regex, term, re.IGNORECASE):
                failed_good_matches.append(("Radarr", term, "DS4K"))
                print(f"  - {term}: {RED}Failed (DS4K regex){RESET}")
            else:
                failed_good_matches.append(("Radarr", term, "Amazon Prime"))
                print(f"  - {term}: {RED}Failed (Amazon Prime regex){RESET}")
        else:
            print(f"  - {term}: {GREEN}Passed{RESET}")

    # Testing Radarr bad matches
    print("\nTesting Radarr bad matches:\n")
    for term in radarr_bad_matches:
        if not re.search(amzn_regex, term, re.IGNORECASE) or re.search(hevc_regex, term, re.IGNORECASE) or re.search(ds4k_regex, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            if re.search(hevc_regex, term, re.IGNORECASE):
                failed_bad_matches.append(("Radarr", term, "HEVC"))
                print(f"  - {term}: {RED}Failed (HEVC regex){RESET}")
            elif re.search(ds4k_regex, term, re.IGNORECASE):
                failed_bad_matches.append(("Radarr", term, "DS4K"))
                print(f"  - {term}: {RED}Failed (DS4K regex){RESET}")
            else:
                failed_bad_matches.append(("Radarr", term, "Amazon Prime"))
                print(f"  - {term}: {RED}Failed (Amazon Prime regex){RESET}")

    # Testing Sonarr good matches
    print("\nTesting Sonarr good matches:\n")
    for term in sonarr_good_matches:
        if not re.search(amzn_regex, term, re.IGNORECASE) or re.search(hevc_regex, term, re.IGNORECASE) or re.search(ds4k_regex, term, re.IGNORECASE):
            if re.search(hevc_regex, term, re.IGNORECASE):
                failed_good_matches.append(("Sonarr", term, "HEVC"))
                print(f"  - {term}: {RED}Failed (HEVC regex){RESET}")
            elif re.search(ds4k_regex, term, re.IGNORECASE):
                failed_good_matches.append(("Sonarr", term, "DS4K"))
                print(f"  - {term}: {RED}Failed (DS4K regex){RESET}")
            else:
                failed_good_matches.append(("Sonarr", term, "Amazon Prime"))
                print(f"  - {term}: {RED}Failed (Amazon Prime regex){RESET}")
        else:
            print(f"  - {term}: {GREEN}Passed{RESET}")

    # Testing Sonarr bad matches
    print("\nTesting Sonarr bad matches:\n")
    for term in sonarr_bad_matches:
        if not re.search(amzn_regex, term, re.IGNORECASE) or re.search(hevc_regex, term, re.IGNORECASE) or re.search(ds4k_regex, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            if re.search(hevc_regex, term, re.IGNORECASE):
                failed_bad_matches.append(("Sonarr", term, "HEVC"))
                print(f"  - {term}: {RED}Failed (HEVC regex){RESET}")
            elif re.search(ds4k_regex, term, re.IGNORECASE):
                failed_bad_matches.append(("Sonarr", term, "DS4K"))
                print(f"  - {term}: {RED}Failed (DS4K regex){RESET}")
            else:
                failed_bad_matches.append(("Sonarr", term, "Amazon Prime"))
                print(f"  - {term}: {RED}Failed (Amazon Prime regex){RESET}")

    # Testing HEVC matches
    print("\nTesting HEVC matches\n")
    for term in hevc_matches:
        if not re.search(hevc_regex, term, re.IGNORECASE):
            failed_bad_matches.append(("Either", term, "HEVC"))
            print(f"  - {term}: {RED}Failed (HEVC regex){RESET}")
        else:
            print(f"  - {term}: {GREEN}Passed{RESET}")

    # Testing DS4K matches
    print("\nTesting DS4K matches\n")
    for term in ds4k_matches:
        if not re.search(ds4k_regex, term, re.IGNORECASE):
            failed_bad_matches.append(("Either", term, "DS4K"))
            print(f"  - {term}: {RED}Failed (DS4K regex){RESET}")
        else:
            print(f"  - {term}: {GREEN}Passed{RESET}")

    # Print all failed matches at the end
    if failed_good_matches or failed_bad_matches:
        print("\nFailed Matches:")
        print("----------------")
        for category, term, regex_type in failed_good_matches:
            print(f"  - {category} Good Match ({regex_type}): {term}")
        for category, term, regex_type in failed_bad_matches:
            print(f"  - {category} Bad Match ({regex_type}): {term}")

    # Calculate total tests and passed tests
    total_tests = len(radarr_good_matches) + len(radarr_bad_matches) + len(sonarr_good_matches) + len(sonarr_bad_matches) + len(hevc_matches) + len(ds4k_matches)
    total_failed = len(failed_good_matches) + len(failed_bad_matches)
    total_passed = total_tests - total_failed
    pass_percentage = (total_passed / total_tests) * 100

    # Print the summary
    print("\nTest Summary:")
    print("-------------")
    print(f"Total tests: {total_tests}")
    print(f"Total passed: {total_passed}")
    print(f"Total failed: {total_failed}")
    print(f"Pass percentage: {pass_percentage:.2f}%")
    print("Pass percentage needed: 98.00%")

    # Determine and print overall test result
    if pass_percentage >= 98:
        print("Test Result: Passed")
        return True
    else:
        print("Test Result: Failed")
        return False
