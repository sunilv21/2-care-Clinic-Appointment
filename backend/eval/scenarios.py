"""eval/scenarios.py — scripted multi-turn conversations for the harness.

Each scenario is a list of caller utterances (one 'turn' each). Languages are kept separate so metrics
report per-language (English / Hindi / Hinglish), never blended. `expect_booking` marks whether a
confirmed booking is the success condition; escalation scenarios expect a follow-up instead.
"""

SCENARIOS = [
    {
        "id": "en_earliest", "lang": "en", "phone": "+919876500001", "expect_booking": True,
        "turns": [
            "Hi, this is Aarav Sharma. I'd like the earliest appointment with any doctor, whichever branch is soonest.",
            "Yes, please book that one.",
        ],
    },
    {
        "id": "en_derm_branch", "lang": "en", "phone": "+919876500002", "expect_booking": True,
        "turns": [
            "Hello, I need a dermatology appointment at your Whitefield branch. My name is Meera Nair.",
            "Whenever the earliest opening is this week — what do you have?",
            "Book the first one, thanks.",
        ],
    },
    {
        "id": "en_underspecified_thu", "lang": "en", "phone": "+919876500003", "expect_booking": True,
        "turns": [
            "Hi, I'm Rohan Nair. Do you have any general medicine slot on Thursday morning?",
            "The earliest one is fine, please book it.",
        ],
    },
    {
        "id": "hi_derm", "lang": "hi", "phone": "+919876500004", "expect_booking": True,
        "turns": [
            "Namaste, mujhe dermatology ka appointment chahiye Whitefield branch mein. Mera naam Kavita Sharma hai.",
            "Kal ka koi slot jo sabse pehle mile?",
            "Haan, book kar dijiye.",
        ],
    },
    {
        "id": "hinglish_peds", "lang": "hinglish", "phone": "+919876500005", "expect_booking": True,
        "turns": [
            "Hi, mujhe kal ek paediatric appointment book karni hai Indiranagar branch mein. Naam hai Aarav Verma.",
            "Sabse early slot chahiye, please confirm kar dijiye.",
        ],
    },
    {
        "id": "en_escalation", "lang": "en", "phone": "+919876500006", "expect_booking": False,
        "turns": [
            "Are you a real person or a bot?",
            "I have a question about my medication dosage — I really need to speak to a doctor.",
        ],
    },
]
