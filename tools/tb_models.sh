#!/bin/bash
# ტფილისი's landmarks, each from Meshy's file to the board's two (art/m_tb_NAME.glb, art/mobile/m_tb_NAME.glb; city.js says
# where they stand): bash tb_models.sh MESHY_DIR OUT_DIR   (then copy OUT_DIR's files into art/ and OUT_DIR/mobile's into
# art/mobile/). The phone's files, and the computer's where the picture's seams stop the simplifying, are baked: bake.mjs.
cd "$(dirname "$0")"
IN="$1"; OUT="$2"
[ -d "$IN" ] && [ -n "$OUT" ] || { echo "bash tb_models.sh MESHY_DIR OUT_DIR"; exit 1; }
run() { n=$1; f=$2; shift 2; node --max-old-space-size=6000 tb_make.mjs "$IN/Meshy_AI_${f}_texture.glb" "$OUT" "$n" "$@" > "$OUT/$n.log" 2>&1; echo "$n: $(grep -E 'KB$|baking' "$OUT/$n.log" | sed 's/.*\///' | tr '\n' ' ')"; }
mkdir -p "$OUT"
run m_tb_bench       Lamplit_Garden_Bench_1025075031 --tris 20000 --tex 1024 --mtris 5000 --mtex 768
run m_tb_stonebridge Riverside_Stone_Bridg_1025075048 --cut auto --keep -0.51,0.51,-0.23,0.012 --recenter 1 --tris 24000 --tex 1024 --mtris 6000 --mtex 768
run m_tb_peace       Azure_Canopy_Bridge_1025075012 --cut auto --keep -0.43,0.43,-0.105,0.1 --recenter 1 --tris 26000 --tex 1024 --mtris 6000 --mtex 768
run m_tb_metekhi     Stonewater_Bridge_1025075018 --cut auto --keep -0.51,0.51,-0.195,0.088 --recenter 1 --tris 30000 --tex 1024 --mtris 6000 --mtex 768
run m_tb_baths       Domed_Brick_Bathhouse_1025075105 --tris 32000 --tex 1024 --mtris 8000 --mtex 768
run m_tb_bank        Old_Town_Bank_1025075126 --tris 26000 --tex 1024 --mtris 8000 --mtex 768
run m_tb_freedom     Golden_Knight_Plaza_1025075113 --tris 36000 --tex 1024 --mtris 9000 --mtex 1024
run m_tb_sameba      Golden_Dome_Cathedral_1025075059 --tris 36000 --tex 1024 --mtris 9000 --mtex 768
run m_tb_rustaveli   Grand_Civic_Promenade_1025075024 --tris 36000 --tex 1024 --mtris 9000 --mtex 1024
run m_tb_courtyard   Sunlit_Mediterranean__1025075120 --tris 36000 --tex 1024 --mtris 9000 --mtex 768
run m_tb_narikala    Hilltop_Citadel_with__1024204240 --tris 60000 --tex 2048 --mtris 15000 --mtex 1024
# the middle's great mountain: more of everything, its many small pieces packed with bigger patches and less room between
run m_tb_mtatsminda  Hilltop_Signal_Statio_1025074957 --tris 120000 --tex 3072 --mtris 30000 --mtex 2048 --err 0.01 --charts 10 --pad 2
# Kartlis Deda came from a lighter export of its Meshy model (300 000 triangles):
#   node tb_make.mjs kd_300k.glb "$OUT" m_tb_kartlisdeda --tris 30000 --tex 1024 --mtris 6000 --mtex 768
echo done
