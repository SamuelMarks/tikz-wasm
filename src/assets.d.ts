// Tells TypeScript that importing ?inline returns a string
declare module '*?inline' {
  const content: string;
  export default content;
}