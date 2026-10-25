export interface Profile {
  data: number;
  runs: number;
  escaped: number;
  best: number;
}

const KEY = 'swarm.profile.v1';

const EMPTY: Profile = { data: 0, runs: 0, escaped: 0, best: 0 };

export interface ProfileStore {
  load(): Profile;
  save(p: Profile): void;
}

export class LocalProfile implements ProfileStore {
  load(): Profile {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...EMPTY };
      const parsed = JSON.parse(raw) as Partial<Profile>;
      return {
        data: Number(parsed.data ?? 0),
        runs: Number(parsed.runs ?? 0),
        escaped: Number(parsed.escaped ?? 0),
        best: Number(parsed.best ?? 0)
      };
    } catch {
      return { ...EMPTY };
    }
  }

  save(p: Profile): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // Private mode, or storage full. The run still counts in memory.
    }
  }
}
