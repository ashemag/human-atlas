#!/usr/bin/env bash
# Ubuntu 24.04 only. Download/extract packaged Blender without installing system packages.
set -euo pipefail
review_root="${1:-/tmp/human-atlas-blender}"
mkdir -p "$review_root/debs" "$review_root/root"
cd "$review_root/debs"
apt-get download \
  blender \
  blender-data \
  libaec0 \
  libarmadillo12 \
  libarpack2t64 \
  libblosc1 \
  libboost-iostreams1.83.0 \
  libboost-locale1.83.0 \
  libboost-thread1.83.0 \
  libcfitsio10t64 \
  libcharls2 \
  libdcmtk17t64 \
  libembree4-4 \
  libfftw3-single3 \
  libfreexl1 \
  libfyba0t64 \
  libgdal34t64 \
  libgdcm3.0t64 \
  libgeos-c1t64 \
  libgeos3.12.1t64 \
  libgeotiff5 \
  libgphoto2-6t64 \
  libgphoto2-port12t64 \
  libgstreamer-plugins-base1.0-0 \
  libhdf4-0-alt \
  libhdf5-103-1t64 \
  libhdf5-hl-100t64 \
  libimath-3-1-29t64 \
  libjemalloc2 \
  libkmlbase1t64 \
  libkmldom1t64 \
  libkmlengine1t64 \
  liblog4cplus-2.0.5t64 \
  libltdl7 \
  libminizip1t64 \
  libmysqlclient21 \
  libnetcdf19t64 \
  libodbc2 \
  libodbcinst2 \
  libogdi4.1 \
  libopencolorio2.1t64 \
  libopencv-core406t64 \
  libopencv-imgcodecs406t64 \
  libopencv-imgproc406t64 \
  libopencv-videoio406t64 \
  libopenexr-3-1-30 \
  libopenimageio2.4t64 \
  libopenvdb10.0t64 \
  liborc-0.4-0t64 \
  libosdcpu3.5.0t64 \
  libosdgpu3.5.0t64 \
  libpoppler134 \
  libpotrace0 \
  libpq5 \
  libproj25 \
  libpugixml1v5 \
  libpystring0 \
  libqhull-r8.0 \
  libraw23t64 \
  librttopo1 \
  libspatialite8t64 \
  libspnav0 \
  libsuperlu6 \
  libsz2 \
  libtbb12 \
  liburiparser1 \
  libxerces-c3.2t64 \
  libyaml-cpp0.8
for package in ./*.deb; do dpkg-deb -x "$package" "$review_root/root"; done
LD_LIBRARY_PATH="$review_root/root/usr/lib/x86_64-linux-gnu:$review_root/root/usr/lib" "$review_root/root/usr/bin/blender" --version
