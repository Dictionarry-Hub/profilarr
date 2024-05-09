# run_tests.py
import sys
from roku import roku
# ... import other test functions

def run_tests():
    tests = [
        ("ROKU", roku),
        # ... add other test functions
    ]

    failed_tests = []
    for test_name, test_func in tests:
        print(f"Running test: {test_name}")
        test_result, failed_good_matches, failed_bad_matches = test_func(debug_level=0)
        if test_result:
            print(f"Test passed: {test_name}\n")
        else:
            print(f"Test failed: {test_name}")
            if failed_bad_matches:
                print("The following terms should not have matched:")
                for platform, term in failed_bad_matches:
                    print(f"- {platform}: {term}")
            if failed_good_matches:
                print("The following terms should have matched:")
                for platform, term in failed_good_matches:
                    print(f"- {platform}: {term}")
            print()
            failed_tests.append((test_name, failed_good_matches, failed_bad_matches))

    if failed_tests:
        print("Some tests failed!")
        sys.exit(1)
    else:
        print("All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    run_tests()