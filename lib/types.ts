export type AccountType = "citoyen" | "elu" | "institution" | "media";
export type Mandate =
  | "president" | "ministre" | "depute" | "senateur" | "maire"
  | "president_conseil_regional" | "gouverneur_district"
  | "conseiller_municipal" | "conseiller_regional" | "autre";

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website: string | null;
  account_type: AccountType;
  verified: boolean;
  verified_at: string | null;
  lang: "fr" | "en";
  theme: "system" | "light" | "dark";
  low_data: boolean;
  shown_commune_id: number | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_owner?: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  suspended_until: string | null;
  onboarded_at: string | null;
  created_at: string;
};

export type PrivateProfile = {
  user_id: string;
  vote_region_id: number | null;
  vote_department_id: number | null;
  vote_commune_id: number | null;
  vote_locality: string | null;
  is_registered_voter: boolean | null;
  phone: string | null;
  birth_year: number | null;
};

export type Media = {
  type: "image" | "video";
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  duration?: number;
  poster?: string;
};

export type Poll = {
  post_id: string;
  options: string[];
  ends_at: string;
  votes_count: number;
  counts: number[];
};

export type Post = {
  id: string;
  author_id: string;
  kind: "post" | "reply" | "quote";
  text: string;
  lang: string;
  parent_id: string | null;
  root_id: string | null;
  quoted_id: string | null;
  visibility: "public" | "followers";
  media: Media[];
  commune_id: number | null;
  hashtags: string[];
  mentions: string[];
  reply_count: number;
  like_count: number;
  repost_count: number;
  quote_count: number;
  bookmark_count: number;
  view_count: number;
  is_pinned: boolean;
  is_hidden: boolean;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type PostLabel = {
  id: string;
  post_id: string;
  label: "contexte" | "contestee" | "fausse" | "satire" | "officiel";
  note: string | null;
  source_url: string | null;
  labeled_by: string;
};

/** A post as rendered: joined with author, poll, quoted post and the viewer's state. */
export type FeedPost = Post & {
  author: Pick<Profile, "id" | "handle" | "display_name" | "avatar_url" | "verified" | "account_type">;
  poll: Poll | null;
  quoted: (Post & { author: FeedPost["author"] }) | null;
  labels: PostLabel[];
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  voted: number | null;
  reposted_by?: Pick<Profile, "handle" | "display_name"> | null;
  reason?: string | null;
};

export type Official = {
  id: string;
  profile_id: string | null;
  full_name: string;
  mandate: Mandate;
  title: string | null;
  party: string | null;
  region_id: number | null;
  department_id: number | null;
  commune_id: number | null;
  circonscription: string | null;
  term_start: string | null;
  term_end: string | null;
  photo_url: string | null;
  bio: string | null;
  claimed_at: string | null;
  profile?: Pick<Profile, "id" | "handle" | "display_name" | "avatar_url" | "verified"> | null;
};

export type Interpellation = {
  id: string;
  author_id: string;
  official_id: string;
  post_id: string | null;
  title: string;
  body: string | null;
  upvotes_count: number;
  status: "ouverte" | "repondue" | "classee";
  answer_post_id: string | null;
  answered_at: string | null;
  created_at: string;
  author?: FeedPost["author"];
  official?: Official;
  voted?: boolean;
};

export type Promise_ = {
  id: string;
  official_id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  made_at: string | null;
  due_at: string | null;
  status: "annoncee" | "en_cours" | "tenue" | "partiellement_tenue" | "non_tenue";
  status_note: string | null;
  created_by: string;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Permanence = {
  id: string;
  official_id: string;
  host_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: "planifiee" | "en_cours" | "terminee" | "annulee";
  post_id: string | null;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type:
    | "like" | "reply" | "repost" | "quote" | "follow" | "mention" | "poll_end"
    | "interpellation_answer" | "official_post" | "verification" | "moderation" | "message" | "following_post";
  post_id: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
  actor?: FeedPost["author"] | null;
  post?: Pick<Post, "id" | "text"> | null;
};

export type Conversation = {
  id: string;
  is_group: boolean;
  title: string | null;
  last_message_at: string | null;
  members: { user_id: string; last_read_at: string | null; profile: FeedPost["author"] }[];
  last_message?: Pick<Message, "text" | "sender_id" | "created_at"> | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  media: Media[];
  created_at: string;
  deleted_at: string | null;
};

export type Report = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  profile_id: string | null;
  message_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  created_at: string;
  reporter?: FeedPost["author"];
  post?: (Pick<Post, "id" | "text" | "author_id" | "is_hidden"> & { author: FeedPost["author"] }) | null;
  profile?: FeedPost["author"] | null;
};

export type VerificationRequest = {
  id: string;
  user_id: string;
  requested_type: AccountType;
  full_name: string;
  official_id: string | null;
  organisation: string | null;
  document_path: string | null;
  proof_path: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  created_at: string;
  user?: FeedPost["author"];
};

export type Proposition = {
  id: string;
  author_id: string;
  commune_id: number;
  title: string;
  body: string;
  votes_count: number;
  status: "nouvelle" | "etudiee" | "adoptee" | "refusee";
  response_post_id: string | null;
  created_at: string;
  author?: FeedPost["author"];
  voted?: boolean;
};

export type Barometer = {
  id: string;
  month: string;
  question: string;
  options: string[];
  opens_at: string;
  closes_at: string;
};
