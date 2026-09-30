#!/bin/bash
set -e
declare -A NAMES
NAMES[s1]="liane ecorce resine os planche ficelle bloctaille feuilletressee"
NAMES[s2]="ironore goldore silverore copperore goldingot silveringot copperingot sulfur"
NAMES[s3]="glass circuit screen batteryfull batteryempty explosive padlock hook"
NAMES[s4]="murkywater seawater salt sugar sugarcane insect cookedfish friedegg"
NAMES[s5]="egg energybar pills antiseptic bandage soap coconutoil beer"
NAMES[s6]="venom poisonflask antidote strangebrew mushroom clover seedling waterfilter"
NAMES[s7]="saw woodshovel ironshovel pickaxe bucket repairkit fishingnet torch"
NAMES[s8]="lighter matches club woodspear woodsword ironsword woodshield ironshield"
NAMES[s9]="tshirt leathertunic sneakers strawhat leafskirt sandals smallbag bigbag"
NAMES[s10]="magnifier compass whistle flaregun flare treasurekey woodendoor trap"

for sheet in s1 s2 s3 s4 s5 s6 s7 s8 s9 s10; do
  read -ra names <<< "${NAMES[$sheet]}"
  W=$(identify -format "%w" sheets/$sheet.png); H=$(identify -format "%h" sheets/$sheet.png)
  CW=$((W/4)); CH=$((H/2))
  i=0
  for r in 0 1; do for c in 0 1 2 3; do
    name=${names[$i]}; i=$((i+1))
    convert sheets/$sheet.png -crop ${CW}x${CH}+$((c*CW))+$((r*CH)) +repage /tmp/cell.png
    cw=$(identify -format "%w" /tmp/cell.png); ch=$(identify -format "%h" /tmp/cell.png)
    convert /tmp/cell.png -alpha set -channel RGBA -fuzz 6% -fill none \
      -draw "matte 2,2 floodfill" \
      -draw "matte $((cw-3)),2 floodfill" \
      -draw "matte 2,$((ch-3)) floodfill" \
      -draw "matte $((cw-3)),$((ch-3)) floodfill" \
      -trim +repage \
      -resize 440x440 -background none -gravity center -extent 480x480 \
      "$name.png" 2>/dev/null || echo "ECHEC: $sheet/$name"
  done; done
  echo "$sheet OK"
done
