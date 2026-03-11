import FarmChat from "./FarmChat";
import styles from "../FarmChatFeature.module.css";

export default function FarmChatFeature() {
  return (
    <div className={styles.container}>
      <h2>AI Chat Feature</h2>
      <FarmChat />
    </div>
  );
}
