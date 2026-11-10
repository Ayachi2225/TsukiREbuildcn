// random.js - the game's two sources of random numbers (TODO item 120).
//
// 1. The engine's own generator: a TinyMT (nn::util::TinyMt, object at system +0x50, vtable 0xad39f8) that the engine's
//    start-up seeds with four bytes from the console's random source (0xfac30: nn::os::GenerateRandomBytes into the
//    settings' +0x5c; 0xfb804 -> 0xfe234, which takes the clock instead when they read as a negative number). Quakes
//    (SQK2, MSQK), a shake's multiplicity, the grain's place and a speed line's angle come from it (0xa8f70 / 0xa8f90 /
//    0xb5290), with the title's and the menus' particles: its numbers are different at every launch, so there is no
//    sequence to copy and the port's own (effects.js, screenfx.js) stand in for it.
//
// 2. The C library's rand() (the SDK's 0x557850, musl's: state x 6364136223846793005 + 1 in 64 bits, the top 31 bits
//    returned). Nothing ever seeds it (the game does not import srand, and its state starts at 0), so its numbers are
//    the same at every launch. A sway's amplitudes, periods and signs (0x3c970 at 0x3d224-0x3d560) and the speed
//    lines' counts and distances (0x86850 at 0x86ab4, 0x862e0 at 0x863a4) are drawn from it, in frame order: so the
//    first sway after starting the game always moves the same way (native runs, 2026-11-09). crand() is that function,
//    and the port draws from it at the same moments.
let state = 0n;
const MASK = (1n << 64n) - 1n;

export function crand() {
  state = (state * 6364136223846793005n + 1n) & MASK;
  return Number(state >> 33n);
}

// rand() x 2^-31 as the game computes it: both steps in single precision (scvtf; fmul).
export const crandUnit = () => Math.fround(Math.fround(crand()) * 2 ** -31);

// A whole number between a and b: r x (b - a) + a in single precision, cut towards zero (0x3d228-0x3d244). b itself
// comes out only when the unit rounds to 1; the ends are used as given, not sorted.
export function crandBetween(a, b) {
  return Math.trunc(Math.fround(Math.fround(crandUnit() * Math.fround(b - a)) + Math.fround(a)));
}

// For tests and for looking at the state: the game's starts at 0 and is never set.
export function crandSeed(s = 0n) { state = BigInt(s) & MASK; }
export const crandState = () => state;
