export type AuthStackParamList = {
  Login: undefined;
  CreateAccount: undefined;
};

export type NotesStackParamList = {
  Home: undefined;
  NoteDetail: { id: string };
  NoteEdit: { id: string };
  Recording: { noteType: 'dictation' | 'consultation' };
  Consent: undefined;
  Processing: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type RootTabParamList = {
  NotesTab: undefined;
  NewNoteTab: undefined;
  SettingsTab: undefined;
};
