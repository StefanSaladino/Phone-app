import { supabase } from '../lib/supabase';
import type {
  Couple,
  CoupleDashboardCounts,
  CoupleMember,
  CoupleMemberWithProfile,
  CoupleWorkspace,
  Profile,
} from '../types/couple';

/**
 * Converts an unknown Supabase error into a stable Error instance.
 */
function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallbackMessage);
}

/**
 * Reads the live dashboard totals for one couple.
 * Supabase performs count-only requests, so no full record lists are downloaded.
 */
async function loadDashboardCounts(
  coupleId: string,
  currentUserId: string,
): Promise<CoupleDashboardCounts> {
  const [dateIdeasResult, placesResult, unreadNotesResult] = await Promise.all([
    supabase
      .from('date_ideas')
      .select('*', { count: 'exact', head: true })
      .eq('couple_id', coupleId),
    supabase
      .from('places')
      .select('*', { count: 'exact', head: true })
      .eq('couple_id', coupleId),
    supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('couple_id', coupleId)
      .eq('recipient_id', currentUserId)
      .is('seen_at', null)
      .is('dismissed_at', null),
  ]);

  const firstError =
    dateIdeasResult.error ?? placesResult.error ?? unreadNotesResult.error;

  if (firstError) {
    throw toError(firstError, 'Unable to load the shared dashboard totals.');
  }

  return {
    dateIdeas: dateIdeasResult.count ?? 0,
    savedPlaces: placesResult.count ?? 0,
    unreadNotes: unreadNotesResult.count ?? 0,
  };
}

/**
 * Loads the complete two-person workspace for the authenticated user.
 * RLS still decides which rows are available; this service only coordinates reads.
 */
export async function loadCoupleWorkspace(
  currentUserId: string,
): Promise<CoupleWorkspace> {
  const membershipResult = await supabase
    .from('couple_members')
    .select('couple_id, user_id, role, joined_at')
    .eq('user_id', currentUserId)
    .maybeSingle<CoupleMember>();

  if (membershipResult.error) {
    throw toError(membershipResult.error, 'Unable to load your couple membership.');
  }

  if (!membershipResult.data) {
    throw new Error('This account has not been linked to a couple workspace yet.');
  }

  const coupleId = membershipResult.data.couple_id;

  const [coupleResult, membersResult, counts] = await Promise.all([
    supabase
      .from('couples')
      .select('id, name, created_by, created_at, updated_at')
      .eq('id', coupleId)
      .single<Couple>(),
    supabase
      .from('couple_members')
      .select('couple_id, user_id, role, joined_at')
      .eq('couple_id', coupleId)
      .order('joined_at', { ascending: true })
      .returns<CoupleMember[]>(),
    loadDashboardCounts(coupleId, currentUserId),
  ]);

  if (coupleResult.error) {
    throw toError(coupleResult.error, 'Unable to load the shared couple record.');
  }

  if (membersResult.error) {
    throw toError(membersResult.error, 'Unable to load the couple members.');
  }

  if (membersResult.data.length !== 2) {
    throw new Error('The couple workspace must contain exactly two linked accounts.');
  }

  const memberIds = membersResult.data.map((member) => member.user_id);

  const profilesResult = await supabase
    .from('profiles')
    .select(
      'id, first_name, last_name, display_name, avatar_url, created_at, updated_at',
    )
    .in('id', memberIds)
    .returns<Profile[]>();

  if (profilesResult.error) {
    throw toError(profilesResult.error, 'Unable to load the couple profiles.');
  }

  const profilesById = new Map(
    profilesResult.data.map((profile) => [profile.id, profile]),
  );

  const membersWithProfiles: CoupleMemberWithProfile[] = membersResult.data.map(
    (member) => {
      const profile = profilesById.get(member.user_id);

      if (!profile) {
        throw new Error('A linked account is missing its profile record.');
      }

      return {
        ...member,
        profile,
      };
    },
  );

  const currentMember = membersWithProfiles.find(
    (member) => member.user_id === currentUserId,
  );
  const partnerMember = membersWithProfiles.find(
    (member) => member.user_id !== currentUserId,
  );

  if (!currentMember || !partnerMember) {
    throw new Error('Unable to identify both people in this workspace.');
  }

  return {
    couple: coupleResult.data,
    currentMember,
    partnerMember,
    members: membersWithProfiles,
    counts,
  };
}
