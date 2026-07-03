import Link, { LinkProps } from "next/link";
import styles from "@/styles/Button.module.css";

interface Props
  extends React.ButtonHTMLAttributes<HTMLButtonElement | LinkProps> {
  children: React.ReactNode;
  href?: string;
  variant?: "contained" | "primary";
  animate?: boolean;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

function Button({
  variant = "contained",
  animate = false,
  loading = false,
  startIcon,
  endIcon,
  children,
  className: classNameProp,
  disabled,
  ...props
}: Props) {
  const className = [
    styles.button,
    styles[variant],
    animate && !loading ? styles.animate : "",
    loading ? styles.loading : "",
    classNameProp,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {!loading && startIcon}
      {children}
      {!loading && endIcon}
    </>
  );

  return props.href ? (
    <Link href={props.href} className={className}>
      {content}
    </Link>
  ) : (
    <button
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  );
}

export default Button;
