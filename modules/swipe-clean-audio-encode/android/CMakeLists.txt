cmake_minimum_required(VERSION 3.18)
project(swipecleanlame C)

# Vendored LAME 3.100 lives at the module root (sibling of android/).
set(LAME_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../lame)

file(GLOB LAME_SRC
  ${LAME_DIR}/libmp3lame/*.c
  ${LAME_DIR}/libmp3lame/vector/*.c
  ${LAME_DIR}/mpglib/*.c
)

add_library(swipecleanlame SHARED
  ${LAME_SRC}
  ${CMAKE_CURRENT_SOURCE_DIR}/src/main/cpp/lame_jni.c
)

target_include_directories(swipecleanlame PRIVATE
  ${LAME_DIR}
  ${LAME_DIR}/libmp3lame
  ${LAME_DIR}/mpglib
  ${LAME_DIR}/include
)

# HAVE_CONFIG_H makes LAME pull in our hand-written config.h; -w silences LAME's
# (many, benign) legacy warnings so they don't drown the build log.
target_compile_definitions(swipecleanlame PRIVATE HAVE_CONFIG_H=1)
target_compile_options(swipecleanlame PRIVATE -O2 -w -DNDEBUG -ffast-math)

target_link_libraries(swipecleanlame m)
