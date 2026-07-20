/**
 * Database-facing types used by the couple workspace feature.
 * Keeping them together prevents page components from duplicating table shapes.
 */
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CoupleMemberRole = 'owner' | 'partner';

export interface CoupleMember {
  couple_id: string;
  user_id: string;
  role: CoupleMemberRole;
  joined_at: string;
}

export interface CoupleMemberWithProfile extends CoupleMember {
  profile: Profile;
}

export interface CoupleDashboardCounts {
  dateIdeas: number;
  savedPlaces: number;
  unreadNotes: number;
}

export interface CoupleWorkspace {
  couple: Couple;
  currentMember: CoupleMemberWithProfile;
  partnerMember: CoupleMemberWithProfile;
  members: CoupleMemberWithProfile[];
  counts: CoupleDashboardCounts;
}
