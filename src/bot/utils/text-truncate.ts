export const truncate = (text: string, maxLength: number = 45) => {
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}
