/**
 * Re-export relay constants from the relays feature.
 * Domain code lives in app/features/relays/; this file exists for backward compatibility.
 * New code should import from ~/features/relays/relay-constants.
 */
export {
  relaysArray,
  DEFAULT_USER_WRITE_RELAYS,
  blastrRelay,
} from "~/features/relays/relay-constants";
