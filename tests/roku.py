from extract import get_custom_format, get_regex
import re
import sys

def roku(debug_level=0):
    # Get the custom formats for "roku" from both Radarr and Sonarr
    roku_radarr = get_custom_format("roku", "radarr", debug_level)
    roku_sonarr = get_custom_format("roku", "sonarr", debug_level)

    # Extract the regex values for both Radarr and Sonarr using get_regex
    roku_value_radarr = get_regex(roku_radarr, "roku", debug_level)
    roku_value_sonarr = get_regex(roku_sonarr, "roku", debug_level)

    if debug_level == 0:
        print(f"Testing with regex: {roku_value_radarr}")

    # Compare Radarr and Sonarr Roku regex values
    if roku_value_radarr != roku_value_sonarr:
        print("Test Failed: regex value not same.")
        print(f"Radarr regex: {roku_value_radarr}")
        print(f"Sonarr regex: {roku_value_sonarr}")
        sys.exit(1)

    radarr_good_matches = [
        "Weird The Al Yankovic Story 2022 1080p ROKU WEB-DL DD5.1 H.264-SMURF",
        "The.Spiderwick.Chronicles.2024.S01E06.1028.Teeth.1080p.ROKU.WEB-DL.DD5.1.H.264-playWEB",
        "The Imitation Game 2014 1080p ROKU WEB-DL AAC 2 0 H 264-PiRaTeS"
    ]
    radarr_bad_matches = [
        "Ikimono no kiroku 1955 720p BluRay FLAC x264-EA.mkv"
    ]
    sonarr_good_matches = [
        "The Now S01 1080p ROKU WEB-DL DD5 1 H 264-WELP",
        "The Rockford Files S01 1080p ROKU WEB-DL HE-AAC 2 0 H 264-PiRaTeS",
        "50.States.of.Fright.S02E05.13.Steps.to.Hell.Washington.Part.2.1080p.ROKU.WEB-DL.DD5.1.H.264-NTb"
    ]
    sonarr_bad_matches = [
        "Avatar.The.Last.Airbender.S01E08.Avatar.Roku.Winter.Solstice.2.1080p.AMZN.WEB-DL.DD+2.0.H.264-CtrlHD",
        "[HorribleSubs] Rokujouma no Shinryakusha - 01 [480p]"
    ]


    failed_good_matches = []
    failed_bad_matches = []

    # Check Radarr good matches
    for term in radarr_good_matches:
        if not re.search(roku_value_radarr, term, re.IGNORECASE):
            failed_good_matches.append(("Radarr", term))

    # Check Radarr bad matches
    for term in radarr_bad_matches:
        if re.search(roku_value_radarr, term, re.IGNORECASE):
            failed_bad_matches.append(("Radarr", term))

    # Check Sonarr good matches
    for term in sonarr_good_matches:
        if not re.search(roku_value_sonarr, term, re.IGNORECASE):
            failed_good_matches.append(("Sonarr", term))

    # Check Sonarr bad matches
    for term in sonarr_bad_matches:
        if re.search(roku_value_sonarr, term, re.IGNORECASE):
            failed_bad_matches.append(("Sonarr", term))

    # Return test result as a tuple (status, failed_good_matches, failed_bad_matches)
    if not failed_good_matches and not failed_bad_matches:
        if debug_level > 0:
            print("Test Passed!")
        return True, [], []
    else:
        return False, failed_good_matches, failed_bad_matches

# Call the test function with debug level
if __name__ == "__main__":
    test_result, failed_good_matches, failed_bad_matches = roku(1)
    if not test_result:
        print("Test Failed!")
        if failed_bad_matches:
            print("\nThe following terms should not have matched:")
            for platform, term in failed_bad_matches:
                print(f"- {platform}: {term}")
        if failed_good_matches:
            print("\nThe following terms should have matched:")
            for platform, term in failed_good_matches:
                print(f"- {platform}: {term}")
        sys.exit(1)


        
