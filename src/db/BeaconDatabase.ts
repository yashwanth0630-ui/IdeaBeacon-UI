import { IdeaEntity, ProjectEntity, TimelineMilestoneEntity, SyncStatus } from './schemas';
import { INITIAL_IDEAS, INITIAL_PROJECT, INITIAL_TIMELINE_EVENTS } from '../data/initialData';
import { BeaconIndexedDB } from './BeaconIndexedDB';

const STORAGE_KEYS = {
  IDEAS: 'idea_beacon_ideas_v2',
  PROJECT: 'idea_beacon_project_v2',
  TIMELINE: 'idea_beacon_timeline_v2',
  SETTINGS: 'idea_beacon_settings_v2',
};

type Listener = () => void;

class BeaconDatabaseClass {
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.initDatabase();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying database listener', err);
      }
    });
  }

  private initDatabase() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.IDEAS)) {
        const seededIdeas: IdeaEntity[] = INITIAL_IDEAS.map((idea) => ({
          ...idea,
          isDemo: true,
          status: idea.status as SyncStatus,
          createdAt: idea.updatedAt,
        }));
        localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(seededIdeas));
      }

      if (!localStorage.getItem(STORAGE_KEYS.PROJECT)) {
        const seededProject: ProjectEntity = {
          ...INITIAL_PROJECT,
          isDemo: true,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.PROJECT, JSON.stringify(seededProject));
      }

      if (!localStorage.getItem(STORAGE_KEYS.TIMELINE)) {
        const seededTimeline: TimelineMilestoneEntity[] = INITIAL_TIMELINE_EVENTS.map((evt) => ({
          id: evt.id,
          projectId: INITIAL_PROJECT.id,
          timestamp: evt.timestamp,
          title: evt.title,
          description: evt.description,
          statusBadge: evt.statusBadge || 'Logged',
          statusType: evt.statusType || 'authored',
          progress: evt.progress,
          progressStep: evt.progressStep,
          speed: evt.speed,
          tags: evt.tags,
          isDemo: true,
          createdAt: new Date().toISOString(),
        }));
        localStorage.setItem(STORAGE_KEYS.TIMELINE, JSON.stringify(seededTimeline));
      }
    } catch (e) {
      console.warn('LocalStorage unavailable in current context', e);
    }
  }

  // --- IDEA DAO ---
  public ideaDao = {
    getAll: (): IdeaEntity[] => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.IDEAS);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },

    getById: (id: string): IdeaEntity | undefined => {
      const all = this.ideaDao.getAll();
      return all.find((item) => item.id === id);
    },

    insert: (idea: Omit<IdeaEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): IdeaEntity => {
      const all = this.ideaDao.getAll();
      const newEntity: IdeaEntity = {
        ...idea,
        id: idea.id || `idea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        isDemo: idea.isDemo ?? false, // user-created ideas default to false
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relativeTime: 'Edited just now',
      };
      const updated = [newEntity, ...all];
      localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(updated));
      this.notify();
      BeaconIndexedDB.captureIdea(newEntity).catch(console.warn);
      return newEntity;
    },

    update: (id: string, updates: Partial<IdeaEntity>): IdeaEntity | null => {
      const all = this.ideaDao.getAll();
      const index = all.findIndex((i) => i.id === id);
      if (index === -1) return null;

      const updatedEntity: IdeaEntity = {
        ...all[index],
        ...updates,
        updatedAt: new Date().toISOString(),
        relativeTime: 'Edited just now',
      };
      all[index] = updatedEntity;
      localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(all));
      this.notify();
      BeaconIndexedDB.updateIdea(id, updates).catch(console.warn);
      return updatedEntity;
    },

    delete: (id: string): boolean => {
      const all = this.ideaDao.getAll();
      const filtered = all.filter((i) => i.id !== id);
      localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(filtered));
      this.notify();
      BeaconIndexedDB.deleteIdea(id).catch(console.warn);
      return true;
    },

    retrySync: (id: string): IdeaEntity | null => {
      return this.ideaDao.update(id, {
        status: 'synced',
        syncErrorMessage: undefined,
        relativeTime: 'Synced just now',
      });
    },

    pushDraft: (id: string): IdeaEntity | null => {
      return this.ideaDao.update(id, {
        status: 'synced',
        relativeTime: 'Synced just now',
      });
    },

    search: (
      queryText: string,
      options?: {
        scope?: 'all' | 'title' | 'tag' | 'content';
        category?: string;
      }
    ): IdeaEntity[] => {
      const all = this.ideaDao.getAll();
      const trimmed = queryText.trim().toLowerCase();
      const scope = options?.scope || 'all';
      const cat = options?.category;

      return all.filter((idea) => {
        if (cat && cat !== 'all' && idea.category.toLowerCase() !== cat.toLowerCase()) {
          return false;
        }

        if (!trimmed) return true;

        const cleanQuery = trimmed.replace(/^#/, '');
        const matchesTitle = idea.title.toLowerCase().includes(trimmed);
        const matchesTag = idea.tags.some(
          (t) =>
            t.toLowerCase().includes(trimmed) ||
            t.toLowerCase().replace(/^#/, '').includes(cleanQuery)
        );
        const matchesContent =
          (idea.content && idea.content.toLowerCase().includes(trimmed)) ||
          (idea.preview && idea.preview.toLowerCase().includes(trimmed));

        switch (scope) {
          case 'title':
            return matchesTitle;
          case 'tag':
            return matchesTag;
          case 'content':
            return matchesContent;
          case 'all':
          default:
            return matchesTitle || matchesTag || matchesContent;
        }
      });
    },

    resolveAllErrors: (): number => {
      const all = this.ideaDao.getAll();
      let resolvedCount = 0;
      const updated = all.map((idea) => {
        if (idea.status === 'error' || idea.status === 'unsynced') {
          resolvedCount++;
          return {
            ...idea,
            status: 'synced' as SyncStatus,
            syncErrorMessage: undefined,
            relativeTime: 'Synced just now',
          };
        }
        return idea;
      });
      localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(updated));
      this.notify();
      return resolvedCount;
    },

    resetToDemoSeed: (): void => {
      localStorage.removeItem(STORAGE_KEYS.IDEAS);
      const seededIdeas: IdeaEntity[] = INITIAL_IDEAS.map((idea) => ({
        ...idea,
        isDemo: true,
        status: idea.status as SyncStatus,
        createdAt: idea.updatedAt,
      }));
      localStorage.setItem(STORAGE_KEYS.IDEAS, JSON.stringify(seededIdeas));
      this.notify();
    },
  };

  // --- PROJECT DAO ---
  public projectDao = {
    get: (): ProjectEntity => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PROJECT);
        return raw ? JSON.parse(raw) : (INITIAL_PROJECT as ProjectEntity);
      } catch {
        return INITIAL_PROJECT as ProjectEntity;
      }
    },

    update: (updates: Partial<ProjectEntity>): ProjectEntity => {
      const current = this.projectDao.get();
      const updated: ProjectEntity = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.PROJECT, JSON.stringify(updated));
      this.notify();
      return updated;
    },
  };

  // --- TIMELINE DAO ---
  public timelineDao = {
    getAll: (): TimelineMilestoneEntity[] => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.TIMELINE);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },

    insert: (milestone: Omit<TimelineMilestoneEntity, 'id' | 'createdAt'>): TimelineMilestoneEntity => {
      const all = this.timelineDao.getAll();
      const newEntity: TimelineMilestoneEntity = {
        ...milestone,
        id: `evt-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [newEntity, ...all];
      localStorage.setItem(STORAGE_KEYS.TIMELINE, JSON.stringify(updated));
      this.notify();
      return newEntity;
    },
  };
}

export const BeaconDatabase = new BeaconDatabaseClass();
