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
    apiSettings: 'API settings',
    startPractice: 'Start practice',
    revealAnswer: 'Reveal answer',
    hideAnswer: 'Hide answer',
    practiceTitle: 'Practice',
    apiUrlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    apiKeyPlaceholder: 'READONLY_KEY',
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
    apiSettings: 'API-inställningar',
    startPractice: 'Starta övning',
    revealAnswer: 'Visa svar',
    hideAnswer: 'Dölj svar',
    practiceTitle: 'Övning',
    apiUrlPlaceholder: 'https://script.google.com/macros/s/.../exec',
    apiKeyPlaceholder: 'READONLY_KEY',
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
