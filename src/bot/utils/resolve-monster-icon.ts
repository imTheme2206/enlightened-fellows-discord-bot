export const resolveMonsterIcon = (monsterName: string): string => {
  return monsterName !== 'Unknown' ? `${monsterName.split(' ').join('_')}_Icon.png` : 'Unknown_Icon.png'
}
