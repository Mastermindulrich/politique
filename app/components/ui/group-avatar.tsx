import { Avatar } from "./avatar";

type Person = { avatar_url: string | null; display_name: string };

/** One avatar for a person, two overlapping avatars for a group. */
export function GroupAvatar({ people, size = 48 }: { people: Person[]; size?: number }) {
  if (people.length < 2) return <Avatar src={people[0]?.avatar_url} name={people[0]?.display_name ?? "?"} size={size} />;
  const small = Math.round(size * 0.68);
  return (
    <span className="relative block flex-none" style={{ width: size, height: size }}>
      <Avatar src={people[0].avatar_url} name={people[0].display_name} size={small} className="absolute left-0 top-0" />
      <Avatar src={people[1].avatar_url} name={people[1].display_name} size={small} className="absolute bottom-0 right-0 ring-2 ring-bg" />
    </span>
  );
}
