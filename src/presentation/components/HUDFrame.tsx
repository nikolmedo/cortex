import styles from './HUDFrame.module.css';

export function HUDFrame({ hidden = false }: { hidden?: boolean }) {
  const cls = hidden ? styles.hidden : '';
  return (
    <>
      <div className={`${styles.tl} ${cls}`} />
      <div className={`${styles.tr} ${cls}`} />
      <div className={`${styles.bl} ${cls}`} />
      <div className={`${styles.br} ${cls}`} />
    </>
  );
}
