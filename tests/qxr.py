from extract import get_custom_format, get_regex
import re
import sys

# ANSI escape codes for colors
GREEN = '\033[92m'
RED = '\033[91m'
RESET = '\033[0m'

qxr_groups = {
    "Tigole QxR" : [
        "A Bug's Life (1998) (2160p UHD BluRay x265 HDR AAC 7.1 English - Tigole QxR)",
        "1408 (2007) Director's Cut (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)",
        "A Fistful of Dollars (1964) (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)",
        "A Taxi Driver (2017) (1080p BluRay x265 SDR AAC 5.1 Korean - Tigole QxR)",
        "A Ghost Story (2017) (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)",
        "Around the World in 80 Days (2004) (1080p BluRay x265 SDR AAC 6.1 English - Tigole QxR)",
        "A Good Marriage (1982) (1080p BluRay x265 SDR AAC 1.0 French - Tigole QxR)",
        "A Prophet (2009) (1080p BluRay x265 SDR AAC 5.1 French - Tigole QxR)",
        "A Pigeon Sat on a Branch Reflecting on Existence (2014) (1080p BluRay x265 SDR AAC 5.1 Swedish - Tigole QxR)",
        "A Man for All Seasons (1966) (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)"
    ],

    "Ghost QxR" : [
        "Gentleman Jack (2019) S01 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - Ghost QxR)",
        "Gentleman Jack (2019) S02 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - Ghost QxR)",
        "Tuca & Bertie (2019) S01 (1080p NF WEB-DL x265 SDR DDP 5.1 English - Ghost QxR)",
        "Tuca & Bertie (2019) S02 (1080p HULU WEB-DL x265 SDR AAC 2.0 English - Ghost QxR)",
        "Barry (2018) S01 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - Ghost QxR)",
        "Barry (2018) S02 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - Ghost QxR)",
        "Barry (2018) S03 (1080p HMAX WEB-DL x265 SDR DD 5.1 English - Ghost QxR)",
        "Scooby-Doo, Where Are You! (1969) S01-S02 (1080p BluRay x265 SDR DD 2.0 English - Ghost QxR)",
        "The Scooby-Doo Show (1976) S01-S03 (1080p Mixed x265 SDR Mixed 2.0 English - Ghost QxR)",
        "What's New, Scooby-Doo? (2002) S01-S03 + Specials (1080p HMAX WEB-DL x265 SDR DD 2.0 English - Ghost QxR)"
    ],

    "Bandi QxR" : [
        "Scooby-Doo! Meets the Boo Brothers (1987) (1080p iT WEB-DL x265 SDR AAC 2.0 English - Ghost QxR)",
        "Ricky Gervais Live 4: Science (2010) (1080p BluRay x265 SDR AAC 2.0 English - Bandi QxR)",
        "City of God (2002) (1080p BluRay x265 SDR DDP 5.1 Portuguese - Bandi QxR)",
        "The Platform (2019) (1080p BluRay x265 SDR DDP 5.1 DUAL - Bandi QxR)",
        "Amores Perros (2000) (1080p BluRay x265 SDR DDP 5.1 Spanish - Bandi QxR)",
        "Day of the Woman (1978) Uncut (1080p BluRay x265 SDR AAC 2.0 English - Bandi QxR)",
        "Frida (2002) (1080p BluRay x265 SDR AAC 5.1 English - Bandi QxR)",
        "Blue Is the Warmest Color (2013) (1080p BluRay x265 SDR AAC 5.1 French - Bandi QxR)",
        "CODA (2021) (1080p DS4K ATVP WEB-DL x265 SDR DDP Atmos 5.1 English - Bandi QxR)",
        "Liz and the Blue Bird (2018) (1080p BluRay x265 SDR AAC 5.1 DUAL - Bandi QxR)"
    ],

    "Silence QxR" : [
        "Parasite (2019) B&W Version (1080p BluRay x265 SDR AAC 5.1 Korean - Silence QxR)",
        "She Said (2022) (1080p MA WEB-DL x265 SDR DDP 5.1 English - Silence QxR)",
        "The Office (2005) S01 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S02 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S03 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S04 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S05 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S06 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S07 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "The Office (2005) S08 (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)"
    ],

    "Rzerox QxR" : [
        "Monk (2002) S01 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - RZeroX QxR)",
        "Monk (2002) S02 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - RZeroX QxR)",
        "Monk (2002) S03 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - RZeroX QxR)",
        "Monk (2002) S08 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - RZeroX QxR)",
        "Monk (2002) S04 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - RZeroX QxR)",
        "Monk (2002) S05 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - RZeroX QxR)",
        "Monk (2002) S06 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - RZeroX QxR)",
        "Monk (2002) S07 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - RZeroX QxR)",
        "Wallace & Gromit - The Curse of the Were-Rabbit (2005) (1080p BluRay x265 SDR AAC 5.1 English - RZeroX QxR)",
        "Gifted (2017) (1080p BluRay x265 SDR AAC 5.1 English - RZeroX QxR)"
    ],

    "Sampa QxR" : [
        "Ad Astra (2019) (2160p UHD BluRay x265 HDR TrueHD Atmos 7.1 English - SAMPA QxR)",
        "Alita - Battle Angel (2019) Open Matte (1080p WEB-DL Hybrid x265 SDR DDP 7.1 English - SAMPA QxR)",
        "The Adventures of Tintin (2011) (1080p BluRay x265 SDR DDP 7.1 English - SAMPA QxR)",
        "The Killer (1989) (1080p BluRay x265 SDR DDP 5.1 DUAL - SAMPA QxR)",
        "The Assassin (2015) (1080p BluRay x265 SDR DD 5.1 Mandarin - SAMPA QxR)",
        "The Incredible Hulk (2008) (1080p BluRay x265 SDR DDP 7.1 English - SAMPA QxR)",
        "The Living Daylights (1987) (1080p BluRay x265 SDR DTS 5.1 English - SAMPA QxR)",
        "Bumblebee (2018) (2160p UHD BluRay x265 HDR TrueHD Atmos 7.1 English - SAMPA QxR)",
        "Pitch Black (2000) (1080p BluRay x265 SDR AAC 5.1 English - Natty QxR)",
        "Queen (2014) (1080p BluRay x265 SDR AAC 7.1 Hindi - Natty QxR)"
    ],

    "FreeTheFish QxR" : [
        "Flubber (1997) (1080p WEBRip x265 SDR DDP 5.1 English - FreetheFish QxR)",
        "The Breakfast Club (1985) Criterion (1080p BluRay x265 SDR AAC 5.1 English - FreetheFish QxR)",
        "A Christmas Story (1983) (1080p BluRay x265 SDR AAC 1.0 English - FreetheFish QxR)",
        "Freaky Friday (2003) 15th Anniversary (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)",
        "How the Grinch Stole Christmas! (1966) (1080p BluRay x265 SDR AAC 2.0 English - FreetheFish QxR)",
        "The Nightmare Before Christmas (1993) (1080p BluRay x265 SDR AAC 7.1 English - FreetheFish QxR)",
        "American History X (1998) (1080p BluRay x265 SDR AAC 7.1 English - FreetheFish QxR)",
        "The Hunchback of Notre Dame (1996) (1080p BluRay x265 SDR AAC 5.1 English - FreetheFish QxR)",
        "Bodied (2018) (1080p DS4K RED WEB-DL x265 SDR AAC 5.1 English - FreetheFish QxR)",
        "Arthur and the Invisibles (2006) (1080p BluRay x265 SDR AAC 5.1 English - FreetheFish QxR)"
    ],

    "Natty QxR" : [
        "Swades (2004) (1080p BluRay x265 SDR AAC 5.1 Hindi - Natty QxR)",
        "You Dont Mess with the Zohan (2008) UNRATED (1080p BluRay x265 SDR AAC 5.1 English - Natty QxR)",
        "Khakee (2004) (1080p BluRay x265 SDR AAC 2.0 Hindi - Natty QxR)",
        "The Message (1976) (1080p BluRay x265 SDR AAC 5.1 English - Natty QxR)",
        "3:10 to Yuma (2007) (1080p BluRay x265 SDR AAC 7.1 English - afm72 QxR)",
        "Premium Rush (2012) (1080p BluRay x265 SDR AAC 5.1 English - afm72 QxR)",
        "Forrest Gump (1994) (1080p BluRay x265 SDR AAC 7.1 English - afm72 QxR)",
        "Bill & Ted's Excellent Adventure (1989) (1080p RM4K  BluRay x265 SDR AAC 2.0 English - Tigole QxR)",
        "Nick and Norah's Infinite Playlist (2008) (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)",
        "Iron Sky (2012) Director's Cut (1080p BluRay x265 SDR AAC 5.1 English - Tigole QxR)"
    ],

    "afm72 QxR" : [
        "21 Grams (2003) (1080p BluRay x265 SDR AAC 5.1 English - afm72 QxR)",
        "Dog Day Afternoon (1975) (1080p BluRay x265 SDR AAC 1.0 English - afm72 QxR)",
        "Bicycle Thieves (1948) Arrow (1080p BluRay x265 SDR AAC 1.0 Italian - afm72 QxR)",
        "Bringing Up Baby (1938) Criterion (1080p BluRay x265 SDR AAC 1.0 English - afm72 QxR)",
        "Definitely, Maybe (2008) (1080p BluRay x265 SDR AAC 5.1 English - afm72 QxR)",
        "La Strada (1954) Criterion (1080p BluRay x265 SDR AAC 1.0 DUAL - afm72 QxR)",
        "Ikiru (1952) Criterion (1080p BluRay x265 SDR AAC 1.0 Japanese - afm72 QxR)",
        "Kes (1970) (1080p BluRay x265 SDR AAC 1.0 English - afm72 QxR)",
        "Where Is My Friend's House? (1987) Criterion (1080p BluRay x265 SDR AAC 1.0 Persian - afm72 QxR)",
        "Stalker (1979) (1080p BluRay x265 SDR AAC 2.0 Russian - afm72 QxR)"
    ],

    "iME QxR" : [
        "The Twilight Zone (1959) S01 (1080p BluRay x265 SDR AAC 2.0 English - ImE QxR)",
        "The Twilight Zone (1959) S02 (1080p BluRay x265 SDR AAC 2.0 English - ImE QxR)",
        "The Twilight Zone (1959) S03 (1080p BluRay x265 SDR AAC 2.0 English - ImE QxR)",
        "The Twilight Zone (1959) S04 (1080p BluRay x265 SDR AAC 2.0 English - ImE QxR)",
        "The Twilight Zone (1959) S05 (1080p BluRay x265 SDR AAC 2.0 English - ImE QxR)",
        "The West Wing (1999) S00 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - ImE QxR)",
        "The West Wing (1999) S01 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - ImE QxR)",
        "The West Wing (1999) S02 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - ImE QxR)",
        "The West Wing (1999) S03 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - ImE QxR)",
        "The West Wing (1999) S04 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - ImE QxR)"
    ],

    "MONOLiTH QxR" : [
        "Last Week Tonight with John Oliver (2014) S01 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S02 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S03 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S04 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S05 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S06 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S07 (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - MONOLITH QxR)",
        "Last Week Tonight with John Oliver (2014) S08 (1080p HMAX WEB-DL x265 SDR DD 2.0 English - MONOLITH QxR)",
        "How It's Made (2001) S24 (1080p WEB-DL x265 SDR AAC 2.0 English - MONOLITH QxR)",
        "How It's Made (2001) S28 (1080p WEB-DL x265 SDR AAC 2.0 English - MONOLITH QxR)"
    ],

    "r00t QxR" : [
        "A Face in the Crowd (1957) (1080p BluRay x265 SDR AAC 1.0 English - r00t QxR)",
        "Anatomy of a Murder (1959) Criterion (1080p BluRay x265 SDR AAC 1.0 English - r00t QxR)",
        "BASEketball (1998) (1080p BluRay x265 SDR AAC 5.1 English - r00t QxR)",
        "Belle de Jour (1967) Criterion (1080p BluRay x265 SDR AAC 1.0 French - r00t QxR)",
        "Blow-Up (1966) Criterion (1080p BluRay x265 SDR AAC 1.0 English - r00t QxR)",
        "Chimes at Midnight (1965) Criterion (1080p BluRay x265 SDR AAC 1.0 English - r00t QxR)",
        "High and Low (1963) Criterion (1080p BluRay x265 SDR AAC 4.0 Japanese - r00t QxR)",
        "House (1977) Criterion (1080p BluRay x265 SDR AAC 1.0 Japanese - r00t QxR)",
        "The Lady from Shanghai (1947) (1080p BluRay x265 SDR AAC 1.0 English - r00t QxR)",
        "The 400 Blows (1959) Criterion (1080p BluRay x265 SDR AAC 1.0 French - r00t QxR)"
    ],

    "RCVR QxR" : [
        "Gavin & Stacey (2007) S01 (1080p BluRay x265 SDR AAC 2.0 English - RCVR QxR)",
        "Gavin & Stacey (2007) S02 (1080p BluRay x265 SDR AAC 2.0 English - RCVR QxR)",
        "Gavin & Stacey (2007) S03 (1080p BluRay x265 SDR AAC 2.0 English - RCVR QxR)",
        "South Park (1997) S01 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)",
        "South Park (1997) S02 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)",
        "South Park (1997) S03 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)",
        "South Park (1997) S04 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)",
        "South Park (1997) S05 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)",
        "South Park (1997) S06 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)",
        "South Park (1997) S07 (1080p BluRay x265 SDR AAC 5.1 English - RCVR QxR)"
    ],

    "YOGi QxR" : [
        "The Boondocks (2005) S01 (1080p HMAX WEB-DL x265 SDR DD 2.0 English - YOGI QxR)",
        "The Boondocks (2005) S02 (1080p HMAX WEB-DL x265 SDR DD 2.0 English - YOGI QxR)",
        "The Boondocks (2005) S03 (1080p HMAX WEB-DL x265 SDR DD 5.1 English - YOGI QxR)",
        "The Boondocks (2005) S04 (1080p HMAX WEB-DL x265 SDR DD 5.1 English - YOGI QxR)",
        "Star Wars - The Clone Wars (2008) S07 (1080p DSNP WEB-DL x265 SDR DDP 5.1 English - YOGI QxR)",
        "A Goofy Movie (1995) (1080p BluRay x265 SDR DD 2.0 English - YOGI QxR)",
        "Rush Hour (1998) (1080p BluRay x265 SDR DDP 7.1 English - YOGI QxR)",
        "Rush Hour 3 (2007) (1080p BluRay x265 SDR DDP 7.1 English - YOGI QxR)",
        "Rush Hour 2 (2001) (1080p BluRay x265 SDR DDP 5.1 English - YOGI QxR)",
        "Rush Hour (2016) S01 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - YOGI QxR)",
        "The VelociPastor (2018) (1080p AMZN WEB-DL x265 SDR DDP 2.0 English - YOGI QxR)"
    ],

    "Kappa QxR" : [
        "Californication (2007) S01 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Californication (2007) S02 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Californication (2007) S03 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Californication (2007) S04 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Californication (2007) S05 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Californication (2007) S06 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Californication (2007) S07 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Chuck (2007) S01 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Chuck (2007) S02 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)",
        "Chuck (2007) S03 (1080p BluRay x265 SDR AAC 5.1 English - Kappa QxR)"
    ],

    "QxR" : [
        "Over the Garden Wall (2014) S01 (1080p BluRay x265 SDR AAC 2.0 English - QxR)"
    ],

    "t3nzin QxR" : [
        "Euphoria (2019) S00E01 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - t3nzin QxR)",
        "Euphoria (2019) S00E02 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - t3nzin QxR)",
        "Euphoria (2019) S01 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - t3nzin QxR)",
        "Euphoria (2019) S02 (1080p AMZN WEB-DL x265 SDR DDP 5.1 English - t3nzin QxR)",
        "House of the Dragon (2022) S01 (1080p BluRay x265 SDR DDP Atmos 5.1 English - t3nzin QxR)",
        "Only Murders in the Building (2021) S02 (1080p DSNP WEB-DL x265 SDR DDP 5.1 English - t3nzin QxR)",
        "Ted Lasso (2020) S02 (1080p ATVP WEB-DL x265 SDR DDP Atmos 5.1 English - t3nzin QxR)",
        "Ted Lasso (2020) S00E07 (1080p ATVP WEB-DL x265 SDR DDP Atmos 5.1 English - t3nzin QxR)",
        "Tiger King (2020) S01 (1080p NF WEB-DL x265 SDR DDP Atmos 5.1 English - t3nzin QxR)",
        "Tiger King (2020) S02 (1080p NF WEB-DL x265 SDR DDP 5.1 English - t3nzin QxR)"
    ],

    "Panda QxR" : [
        "What We Do in the Shadows (2014) (1080p BluRay x265 SDR AAC 5.1 English - Silence QxR)",
        "Black Mirror (2011) S03 (1080p BluRay x265 SDR AAC 5.1 English - Panda QxR)",
        "Black Mirror (2011) S04 (1080p BluRay x265 SDR AAC 5.1 English - Panda QxR)",
        "Threads (1984) (1080p BluRay x265 SDR AAC 2.0 English - Panda QxR)",
        "Bicentennial Man (1999) (1080p AMZN WEB-DL x265 SDR AAC 5.1 English - Panda QxR)",
        "Blue Mountain State (2010) S01 (1080p BluRay x265 SDR AAC 5.1 English - Panda QxR)",
        "Blue Mountain State (2010) S02 (1080p WEB-DL x265 SDR AAC 2.0 English - Panda QxR)",
        "Blue Mountain State (2010) S03 (1080p WEB-DL x265 SDR AAC 2.0 English - Panda QxR)",
        "Blue Mountain State - The Rise of Thadland (2016) (1080p BluRay x265 SDR AAC 5.1 English - Panda QxR)",
        "Children of Men (2006) (1080p BluRay x265 SDR AAC 5.1 English - Panda QxR)"
    ],

    "Garshasp QxR" : [
        "Titanic (1997) (1080p BluRay x265 SDR AAC 5.1 English - Garshasp QxR)",
        "The Red Turtle (2016) (1080p BluRay x265 SDR DDP 5.1 English - Garshasp QxR)",
        "Howl's Moving Castle (2004) (1080p BluRay x265 SDR DDP 5.1 DUAL - Garshasp QxR)",
        "While You Were Sleeping (1995) (1080p BluRay x265 SDR DDP 5.1 English - Garshasp QxR)",
        "From Up on Poppy Hill (2011) (1080p BluRay x265 SDR DDP 5.1 DUAL - Garshasp QxR)",
        "The Wind Rises (2013) (1080p BluRay x265 SDR DDP 2.0 DUAL - Garshasp QxR)",
        "Adventures of Tintin (1991) S01 (1080p BluRay x265 SDR DDP 5.1 DUAL - Garshasp QxR)",
        "Adventures of Tintin (1991) S02 (1080p BluRay x265 SDR DDP 5.1 DUAL - Garshasp QxR)",
        "Adventures of Tintin (1991) S03 (1080p BluRay x265 SDR DDP 5.1 DUAL - Garshasp QxR)",
        "Planet of the Apes (1968) (1080p BluRay x265 SDR DDP 5.1 English - Garshasp QxR)"
    ],

    "Lion QxR" : [
        "Millennium (2010) S01 (1080p BluRay x265 SDR AAC 5.1 Swedish - LION QxR)"
    ],

    "Langbard QxR" : [
        "Constantine (2014) S01 (1080p BluRay x265 SDR AAC 5.1 English - Langbard QxR)"
    ],
}


def qxr(debug_level=0):
    # Get the custom formats for "qxr" from both Radarr and Sonarr
    qxr_radarr = get_custom_format("qxr", "radarr", debug_level)
    qxr_sonarr = get_custom_format("qxr", "sonarr", debug_level)

    # Extract the regex values for both Radarr and Sonarr using get_regex
    qxr_value_radarr = get_regex(qxr_radarr, "qxr", debug_level)
    qxr_value_sonarr = get_regex(qxr_sonarr, "qxr", debug_level)

    # Replace the negative lookbehind with a negative lookahead
    qxr_value_radarr = qxr_value_radarr.replace("(?<=^|[\\s.-])", "(?:^|[\\s.-])")
    qxr_value_sonarr = qxr_value_sonarr.replace("(?<=^|[\\s.-])", "(?:^|[\\s.-])")

    if debug_level > 0:
        print(f"Testing with regex: {qxr_value_radarr}")

    # Compare Radarr and Sonarr qxr regex values
    if qxr_value_radarr != qxr_value_sonarr:
        print("Test Failed: regex value not same.")
        print(f"Radarr regex: {qxr_value_radarr}")
        print(f"Sonarr regex: {qxr_value_sonarr}")
        sys.exit(1)

    failed_matches = []

    for group in qxr_groups:
        print(f"\nTesting {group}:")
        for release in qxr_groups[group]:  # Access the list of releases using the dictionary key
            if re.search(qxr_value_radarr, release, re.IGNORECASE):
                print(f"  - {release}: {GREEN}Passed{RESET}")
            else:
                failed_matches.append(release)
                print(f"  - {release}: {RED}Failed{RESET}")


    # Determine and print overall test result
    if not failed_matches:
        return True
    else:
        return False