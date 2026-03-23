import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SessionState = {
  sessionId: string | null;
};

const initialState: SessionState = {
  sessionId: null,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
    },
    clearSessionId: (state) => {
      state.sessionId = null;
    },
  },
});

export const { setSessionId, clearSessionId } = sessionSlice.actions;
export default sessionSlice.reducer;