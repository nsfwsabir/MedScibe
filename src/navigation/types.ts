export type AuthStackParamList = {
  Login: undefined;
  CreateAccount: undefined;
};

export type NotesStackParamList = {
  Home: undefined;
  NoteDetail: { id: string };
  NoteEdit: { id: string };
  Recording: undefined;
  Processing: { durationSeconds: number; audioUri: string };
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type RootTabParamList = {
  NotesTab: undefined;
  NewNoteTab: undefined;
  SettingsTab: undefined;
};
