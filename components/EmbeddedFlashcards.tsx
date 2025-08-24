'use client';

import FlashcardsModal, { type Flashcard } from '@/components/FlashcardsModal';

const sampleFlashcards: Flashcard[] = [
    {
        "question": "What are the three primary functions of the immune system?",
        "answer": "1. Protects from diseases.\n2. Detects and responds to pathogens, cancer cells, and foreign objects.\n3. Distinguishes self from non-self."
    },
    {
        "question": "What are the two major subsystems of the immune system?",
        "answer": "Innate (non-specific) and Adaptive (specific) immune systems."
    },
    {
        "question": "Which immune subsystem provides a non-specific defense?",
        "answer": "The innate immune system."
    },
    {
        "question": "Which immune subsystem provides a specific, targeted response to pathogens?",
        "answer": "The adaptive immune system."
    },
    {
        "question": "What is the term for an immune dysfunction characterized by a less active immune system?",
        "answer": "Immunodeficiency (e.g., HIV/AIDS)."
    },
    {
        "question": "What is autoimmunity?",
        "answer": "An immune dysfunction where a hyperactive system attacks the body's normal tissues (e.g., Rheumatoid Arthritis)."
    },
    {
        "question": "What is hypersensitivity in the context of the immune system?",
        "answer": "An immune dysfunction where the immune response itself damages the body's own tissues (e.g., allergies)."
    },
    {
        "question": "What is the term for inflammation that occurs without a known cause?",
        "answer": "Idiopathic inflammation."
    },
    {
        "question": "What is the purpose of immunosuppression as a medical intervention?",
        "answer": "To use drugs to control autoimmunity, inflammation, or transplant rejection."
    },
    {
        "question": "How does vaccination modulate the immune system?",
        "answer": "It induces active immunity and develops immunological memory without causing the disease."
    },
    {
        "question": "What is the goal of cancer immunotherapy?",
        "answer": "To stimulate the patient's own immune system to attack tumors."
    },
    {
        "question": "How do the hormones estrogen and testosterone differentially affect the immune system?",
        "answer": "Estrogen acts as an immunostimulator, while testosterone is immunosuppressive."
    },
    {
        "question": "What is a potential benefit of Vitamin D for the immune system?",
        "answer": "It may reduce the risk of autoimmune diseases."
    },
    {
        "question": "How does sleep and rest impact immune function?",
        "answer": "Deprivation is detrimental, while deep sleep supports immune function."
    },
    {
        "question": "What is the general effect of physical exercise on the immune system?",
        "answer": "It has a positive effect, though intense exercise can cause transient immunodepression."
    },
    {
        "question": "List four strategies pathogens use to evade the immune system.",
        "answer": "- Hide within host cells\n- Secrete immune-inhibiting compounds\n- Antigenic variation (e.g., HIV)\n- Masking antigens with host molecules"
    }
];

export default function EmbeddedFlashcards() {
    return (
        <FlashcardsModal
            open={true}
            isEmbedded={true}
            cards={sampleFlashcards}
            title="Sample Flashcards"
            onClose={() => {}}
        />
    );
}
