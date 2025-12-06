// Audio asset type declarations for React Native
// In React Native, require() for assets returns a number (asset ID)
declare module "*.mp3" {
  const value: number;
  export default value;
}

declare module "*.wav" {
  const value: number;
  export default value;
}

declare module "*.m4a" {
  const value: number;
  export default value;
}

declare module "*.aac" {
  const value: number;
  export default value;
}
