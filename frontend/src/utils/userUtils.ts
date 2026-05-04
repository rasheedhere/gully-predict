export const getUserDisplayName = (user: { name: string; alias?: string; use_alias?: boolean } | null | undefined) => {
  if (!user) return 'Unknown Player';
  return user.use_alias && user.alias ? user.alias : user.name;
};
