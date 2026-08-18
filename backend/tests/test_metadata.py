from app.ingest.metadata import parse_filename

def test_metadata_parsing():
    cases = [
        ("Std-9_Maths_English Medium.pdf", "Std_09", "Mathematics"),
        ("STD-11_COMPUTER_STUDIES_EnglishMedium.pdf", "Std_11", "Computer"),
        ("Std-10_Psaychology.pdf", "Std_10", "Psychology"),
        ("12_Bilology.pdf", "Std_12", "Biology"),
        ("Std_10_Sanskrut.pdf", "Std_10", "Sanskrit"),
        ("Std_9_Lapwimg.pdf", "Std_09", "English"),
        ("Std_10_Beehive.pdf", "Std_10", "English")
    ]
    
    for filename, exp_std, exp_sub in cases:
        meta = parse_filename(filename)
        assert meta["standard"] == exp_std, f"Failed on {filename}"
        assert meta["subject"] == exp_sub, f"Failed on {filename}"
