const LS_LANG = 'flashcards_lang_v1';

const DICT = {
  en: {
    langName: 'English',
    language: 'Language',
    setupTitle: 'Practice setup',
    setupSubtitle: 'Choose what to study and start when you\'re ready.',
    chooseContent: 'Choose content',
    subject: 'Subject',
    area: 'Area',
    selectSubject: 'Select a subject…',
    selectArea: 'Select an area…',
    shuffle: 'Shuffle questions',
    apiSettings: 'Settings',
    startPractice: 'Start practice',
    startingPractice: 'Starting…',
    revealAnswer: 'Reveal answer',
    hideAnswer: 'Hide answer',
    practiceTitle: 'Practice',
    apiUrlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    apiKeyPlaceholder: 'READONLY_KEY',
    readyToLoad: 'Ready to load questions',
    countingQuestions: 'Counting questions…',
    questionsInDeck: 'Questions in selected deck',
    questionsInArea: 'Questions in selected area',
    selectSubjectAndArea: 'Select subject and area',
    noCardsLoaded: 'No cards loaded.',
    noTags: 'No tags',
    noCardsFoundArea: 'No cards found in this area.',
    enterApiUrl: 'Please enter API URL.',
    enterApiKey: 'Please enter API key.',
    practiceMode: 'Practice mode',
    shuffleHint: 'Shuffling helps recall and avoids memorizing order.',
    backToSelection: 'Back to selection',
    questionLabel: 'Question',
    answerLabel: 'Answer',
    cancel: 'Cancel',
    save: 'Save',
    savingConfig: 'Saving…',
    apiHint: 'Enter your Apps Script Web App URL and read-only key.',
    modalTip: 'Tip: configure once on the device and keep this hidden.',
  },
  sv: {
    langName: 'Svenska',
    language: 'Språk',
    setupTitle: 'Inställningar för träning',
    setupSubtitle: 'Välj vad du vill öva och starta när du är redo.',
    chooseContent: 'Välj innehåll',
    subject: 'Ämne',
    area: 'Område',
    selectSubject: 'Välj ett ämne…',
    selectArea: 'Välj ett område…',
    shuffle: 'Blanda frågor',
    apiSettings: 'Inställningar',
    startPractice: 'Starta övning',
    startingPractice: 'Startar…',
    revealAnswer: 'Visa svar',
    hideAnswer: 'Dölj svar',
    practiceTitle: 'Övning',
    apiUrlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    apiKeyPlaceholder: 'READONLY_KEY',
    readyToLoad: 'Klar att ladda frågor',
    countingQuestions: 'Räknar frågor…',
    questionsInDeck: 'Frågor i valt ämne',
    questionsInArea: 'Frågor i valt område',
    selectSubjectAndArea: 'Välj ämne och område',
    noCardsLoaded: 'Inga kort hittades.',
    noTags: 'Inga taggar',
    noCardsFoundArea: 'Inga kort hittades i detta område.',
    enterApiUrl: 'Ange API-URL.',
    enterApiKey: 'Ange API-nyckel.',
    practiceMode: 'Övningsläge',
    shuffleHint: 'Blanda frågor hjälper återkallelsen och förhindrar att man memorerar ordningen.',
    backToSelection: 'Tillbaka till urval',
    questionLabel: 'Fråga',
    answerLabel: 'Svar',
    cancel: 'Avbryt',
    save: 'Spara',
    savingConfig: 'Sparar…',
    apiHint: 'Ange din Apps Script Web App URL och read-only-nyckel.',
    modalTip: 'Tips: konfigurera en gång på enheten och håll detta dolt.',
  }
};

export function getLocale() {
  try {
    const v = localStorage.getItem(LS_LANG);
    if (v) return v;
  } catch {}
  // default: use browser language (first two letters) or 'en'
  const nav = (navigator.language || 'en').slice(0,2);
  return DICT[nav] ? nav : 'en';
}

export function setLocale(loc) {
  if (!DICT[loc]) loc = 'en';
  try { localStorage.setItem(LS_LANG, loc); } catch {}
}

export function t(key) {
  const loc = getLocale();
  return (DICT[loc] && DICT[loc][key]) || (DICT['en'] && DICT['en'][key]) || '';
}

export function locales() {
  return Object.keys(DICT).map(k => ({ code: k, name: DICT[k].langName }));
}
