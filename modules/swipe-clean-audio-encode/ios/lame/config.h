/*
 * Hand-written config.h for LAME 3.100, replacing the autotools-generated one.
 * Targets: Android NDK (arm64-v8a / armeabi-v7a / x86_64) and iOS (arm64 device +
 * simulator) — both clang with full C99/POSIX headers. No SSE (ARM), so
 * HAVE_XMMINTRIN_H stays undefined and vector/xmm_quantize_sub.c compiles empty.
 */
#ifndef LAME_CONFIG_H
#define LAME_CONFIG_H

/* Standard headers — present on both toolchains */
#define STDC_HEADERS 1
#define HAVE_LIMITS_H 1
#define HAVE_STRING_H 1
#define HAVE_STRINGS_H 1
#define HAVE_STDLIB_H 1
#define HAVE_MEMORY_H 1
#define HAVE_STDINT_H 1
#define HAVE_INTTYPES_H 1
#define HAVE_UNISTD_H 1
#define HAVE_FCNTL_H 1
#define HAVE_ERRNO_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TIME_H 1
#define HAVE_GETTIMEOFDAY 1
#define HAVE_STRCHR 1
#define HAVE_MEMCPY 1

/* <stdint.h> fixed-width types are available */
#define HAVE_INT8_T 1
#define HAVE_INT16_T 1
#define HAVE_INT32_T 1
#define HAVE_INT64_T 1
#define HAVE_UINT8_T 1
#define HAVE_UINT16_T 1
#define HAVE_UINT32_T 1
#define HAVE_UINT64_T 1

/*
 * LAME 3.100's util.c/util.h use ieee754_float32_t / ieee754_float64_t but ship no
 * fallback typedef (autotools normally supplies them). Provide them here — config.h
 * is included first by every LAME source via HAVE_CONFIG_H. On ARM/clang these are
 * plain IEEE-754 float/double. Do NOT define HAVE_IEEE754_FLOAT32_T: that flag makes
 * LAME expect a system-provided type that doesn't exist on Android/iOS.
 */
typedef float ieee754_float32_t;
typedef double ieee754_float64_t;

/* Type sizes. `long` differs between LP64 (arm64) and ILP32 (armv7/x86). */
#define SIZEOF_SHORT 2
#define SIZEOF_UNSIGNED_SHORT 2
#define SIZEOF_INT 4
#define SIZEOF_UNSIGNED_INT 4
#define SIZEOF_LONG_LONG 8
#define SIZEOF_UNSIGNED_LONG_LONG 8
#define SIZEOF_FLOAT 4
#define SIZEOF_DOUBLE 8
#define SIZEOF_LONG_DOUBLE 8
#if defined(__LP64__) || defined(_LP64)
#define SIZEOF_LONG 8
#define SIZEOF_UNSIGNED_LONG 8
#else
#define SIZEOF_LONG 4
#define SIZEOF_UNSIGNED_LONG 4
#endif

/* LAME build options. NOTE: do NOT define HAVE_NASM (even as 0) — LAME guards its
 * x86 asm (fht_SSE, has_MMX_nasm, …) with #ifdef HAVE_NASM, so any definition pulls
 * in assembly symbols that don't exist on ARM/clang and fail to link. Leaving it
 * undefined selects the pure-C paths. */
#define LAME_LIBRARY_BUILD 1
#define HAVE_MPGLIB 1

/* Package identity (a few sources reference these) */
#define PACKAGE "lame"
#define VERSION "3.100"
#define PACKAGE_NAME "lame"
#define PACKAGE_STRING "lame 3.100"

#endif /* LAME_CONFIG_H */
