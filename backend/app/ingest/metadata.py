import re

def parse_filename(filename: str) -> dict:
    """
    Parses textbook metadata from filename.
    Normalizes standard to Std_09, Std_10, Std_11, Std_12.
    Corrects common typos in subjects.
    Maps literature titles to English.
    """
    metadata = {
        "textbook_name": filename,
        "standard": None,
        "subject": None
    }
    
    # Standard matching
    std_match = re.search(r'(?i)std[-_ ]?0?([9|10|11|12]+)', filename)
    if std_match:
        val = std_match.group(1)
        if val == '9': val = '09'
        metadata["standard"] = f"Std_{val}"

    # Extract words for subject
    parts = re.split(r'[-_ ]', filename.split('.')[0])
    parts = [p for p in parts if p.lower() not in ('std', '9', '10', '11', '12', '09', 'english', 'medium', 'gujaratimrdium', 'englishmedium')]

    subject_str = " ".join(parts).strip()

    # Typo corrections
    corrections = {
        "psaychology": "Psychology",
        "bilology": "Biology",
        "sanskrut": "Sanskrit",
        "lapwimg": "English", # Lapwing is English supplementary
        "beehive": "English",
        "hornbill": "English",
        "maths": "Mathematics",
        "computer studies": "Computer"
    }

    sub_lower = subject_str.lower()
    for wrong, right in corrections.items():
        if wrong in sub_lower:
            metadata["subject"] = right
            return metadata
            
    if subject_str:
        metadata["subject"] = subject_str.title()
    else:
        metadata["subject"] = "Unknown"

    return metadata
