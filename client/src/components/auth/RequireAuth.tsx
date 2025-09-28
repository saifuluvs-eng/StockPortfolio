// Wrap ANY button/interactive element with this.
// If logged out -> opens SignInDialog. If logged in -> runs your handler.
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import SignInDialog from "./SignInDialog";

type Props = {
  onAuthed: () => void;          // what to do if the user IS signed in
  children: React.ReactNode;     // usually a <Button>...</Button>
};

export default function RequireAuth({ onAuthed, children }: Props) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAuthenticated) onAuthed();
    else setOpen(true);
  };

  // Clone the child to intercept its onClick without changing your UI
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        onClick: handleClick,
      })
    : children;

  return (
    <>
      {child}
      <SignInDialog
        open={open}
        onOpenChange={setOpen}
        onSignedIn={() => {
          // optional: refresh or navigate after sign-in
          // window.location.reload();
        }}
      />
    </>
  );
}
