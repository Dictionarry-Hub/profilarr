from extract import get_custom_format, get_regex
import re
import sys

# ANSI escape codes for colors
GREEN = '\033[92m'
RED = '\033[91m'
RESET = '\033[0m'

def amzn(debug_level=0):
    # Get the custom formats for "amazon" from both Radarr and Sonarr
    amzn_old = get_custom_format("Amazon Prime", "radarr", debug_level)
    amzn_new = get_custom_format("Amazon Prime (H264)", "sonarr", debug_level)

    # Extract the regex values for both Radarr and Sonarr using get_regex
    amzn_value_old = get_regex(amzn_old, "Amazon", debug_level)
    amzn_value_new = get_regex(amzn_new, "Amazon", debug_level)

    if debug_level > 0:
        print(f"Testing with old regex: {amzn_value_old}")
        print(f"Testing with new regex: {amzn_value_new}")

    radarr_good_matches = []
    with open('tests/cases/amzn_radarr_good.txt', 'r') as file:
        for line in file:
            # Add lines that don't start with "- H.264"
            if line.startswith('- H.264'):
                radarr_good_matches.append(line.strip())


    radarr_bad_matches = [

    ]

    sonarr_good_matches = [
    ]

    sonarr_bad_matches = [
    ]

    failed_good_matches = []
    failed_bad_matches = []

    # Print
    print("\nTesting with old regex:")
    print("----------------")
    print("Should Match:")
    for term in radarr_good_matches:
        if re.search(amzn_value_old, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_good_matches.append(("Radarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    
    # Print
    print("\nTesting with new regex:")
    print("----------------")
    print("Should Match:")
    for term in radarr_good_matches:
        if re.search(amzn_value_new, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_good_matches.append(("Radarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Print Radarr Bad Matches
    print("\nShould NOT Match:")
    for term in radarr_bad_matches:
        if not re.search(amzn_value_radarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_bad_matches.append(("Radarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Print Sonarr Good Matches
    print("\nSonarr Releases:")
    print("----------------")
    print("Should Match:")
    for term in sonarr_good_matches:
        if re.search(amzn_value_sonarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_good_matches.append(("Sonarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Print Sonarr Bad Matches
    print("\nShould NOT Match:")
    for term in sonarr_bad_matches:
        if not re.search(amzn_value_sonarr, term, re.IGNORECASE):
            print(f"  - {term}: {GREEN}Passed{RESET}")
        else:
            failed_bad_matches.append(("Sonarr", term))
            print(f"  - {term}: {RED}Failed{RESET}")

    # Determine and print overall test result
    if not failed_good_matches and not failed_bad_matches:
        return True
    else:
        return False
