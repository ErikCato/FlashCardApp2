const MOCK = {
  decks: [
    { deckId: "samh1b", title: "Samhällskunskap 1B", sheets: [
      { id: "mr", title: "Mänskliga rättigheter" },
      { id: "eu", title: "Europeiska unionen" }
    ] },
    { deckId: "math", title: "Math", sheets: [
      { id: "algebra", title: "Algebra" }
    ] },
  ],
  cards: {
    "samh1b::mr": [
      { id: "mr-1", question: "What is a human right?", answer: "A fundamental right inherent to all humans.", tags: "HR", level: 1, active: true },
      { id: "mr-2", question: "Which document is central to modern human rights?", answer: "The Universal Declaration of Human Rights (UDHR).", tags: "UN", level: 1, active: true },
      { id: "mr-3", question: "Why do rights matter in a democracy?", answer: "They protect individuals and limit state power.", tags: "Democracy", level: 1, active: true },
    ],
    "samh1b::eu": [
      { id: "eu-1", question: "What does EU stand for?", answer: "European Union.", tags: "EU", level: 1, active: true },
      { id: "eu-2", question: "What is the purpose of the EU single market?", answer: "Free movement of goods, services, people and capital.", tags: "Economy", level: 1, active: true },
    ],
    "math::algebra": [
      { id: "a-1", question: "Solve: 2x + 4 = 10", answer: "x = 3", tags: "Algebra", level: 1, active: true },
      { id: "a-2", question: "What is the distributive property?", answer: "a(b+c)=ab+ac", tags: "Algebra", level: 1, active: true },
    ],
  }
};

export const mockProvider = {
  async getDecks() {
    return MOCK.decks;
  },
  async getCards(deckId, sheet, activeOnly = true) {
    const key = `${deckId}::${sheet}`;
    const list = (MOCK.cards[key] || []).slice();
    return activeOnly ? list.filter(c => c.active !== false) : list;
  }
};