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

// Alias for report-focused naming (UI now says Reports, DB still notes)
export type ReportsStackParamList = NotesStackParamList;

export type SettingsStackParamList = {
  Settings: undefined;
  Profile: undefined;
};

export type RootTabParamList = {
  NotesTab: undefined; // UI label now Reports
  ReportsTab: undefined; // alias for new naming
  NewNoteTab: undefined;
  SettingsTab: undefined;
};
