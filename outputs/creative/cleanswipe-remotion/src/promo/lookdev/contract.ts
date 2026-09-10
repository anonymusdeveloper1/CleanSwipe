/**
 * Look-dev contract. Every phone variant exports a component with this exact
 * shape so the four can be rendered from one composition and compared with
 * nothing else differing between them.
 */
export type PhoneVariantProps = {
  /** Desired on-screen width of the device in px. */
  phoneWidth: number;
  /** PNG under public/, e.g. "screens/swipe-0.png". Map this to the display. */
  screen: string;
  /** Degrees. Convert to radians yourself. */
  rotY?: number;
  rotX?: number;
  rotZ?: number;
};
