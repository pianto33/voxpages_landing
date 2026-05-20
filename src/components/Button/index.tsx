import Link, { LinkProps } from "next/link";
import styles from "@/styles/Button.module.css";

interface Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement | LinkProps> {
  children: React.ReactNode;
  href?: string;
  variant?: "contained" | "primary";
  animate?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  disabled?: boolean;
}

function Button({
  variant = "contained",
  animate = false,
  startIcon,
  endIcon,
  children,
  ...props
}: Props) {
  const className = `${styles.button} ${styles[variant]} ${animate ? styles.animate : ''}`;

  return props.href ? (
    <Link href={props.href} className={className}>
      {startIcon}
      {children}
      {endIcon}
    </Link>
  ) : (
    <button className={className} {...props}>
      {startIcon}
      {children}
      {endIcon}
    </button>
  );
}

export default Button;
