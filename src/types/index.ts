export interface TreeNode {
  id: string;
  name: string;
  type: 'faculty' | 'branch' | 'schedule';
  scheduleType?: string;
  hasChildren: boolean;
  parentId?: string;
  isLeaf?: boolean;
}

export interface ScheduleEvent {
  start: string;
  end: string;
  summary: string;
  subject: string;
  type: string;
  teacher: string;
  room: string;
  location?: string;
  description?: string;
  subjectFullName?: string;
  teacherFullName?: string;
  teacherId?: string;
}

export interface FavoriteGroup {
  id: string;
  name: string;
  path: string[];
  scheduleType: string;
}
