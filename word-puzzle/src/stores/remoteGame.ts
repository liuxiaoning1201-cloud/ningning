import { defineStore } from "pinia";

export interface RemoteRoom {
  id: string;
  puzzleId: string;
  status: "waiting" | "playing" | "ended";
  members: { userId: string; displayName: string }[];
}

export const useRemoteGameStore = defineStore("remoteGame", {
  state: () => ({
    room: null as RemoteRoom | null,
    isConnected: false,
  }),
  actions: {
    setRoom(room: RemoteRoom | null) {
      this.room = room;
    },
    setConnected(connected: boolean) {
      this.isConnected = connected;
    },
  },
});
