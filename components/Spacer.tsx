import { View } from "react-native";


const Spacer = ({ height = 16 }: { height: number }) => {
  return <View style={{ height }} />;
};

export default Spacer;