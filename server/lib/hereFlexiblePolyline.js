/** HERE flexible polyline decoder (MIT, heremaps/flexible-polyline). */
const DECODING_TABLE = [
  62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
];

const FORMAT_VERSION = 1;
const Num = typeof BigInt !== "undefined" ? BigInt : Number;

function decodeChar(char) {
  return DECODING_TABLE[char.charCodeAt(0) - 45];
}

function decodeUnsignedValues(encoded) {
  let result = Num(0);
  let shift = Num(0);
  const resList = [];
  for (const char of encoded) {
    const value = Num(decodeChar(char));
    result |= (value & Num(0x1F)) << shift;
    if ((value & Num(0x20)) === Num(0)) {
      resList.push(result);
      result = Num(0);
      shift = Num(0);
    } else {
      shift += Num(5);
    }
  }
  if (shift > 0) throw new Error("Invalid flexible polyline encoding");
  return resList;
}

function decodeHeader(version, encodedHeader) {
  if (+version.toString() !== FORMAT_VERSION) throw new Error("Invalid polyline format version");
  const headerNumber = +encodedHeader.toString();
  return {
    precision: headerNumber & 15,
    thirdDim: (headerNumber >> 4) & 7,
    thirdDimPrecision: (headerNumber >> 7) & 15,
  };
}

function toSigned(val) {
  let res = val;
  if (res & Num(1)) res = ~res;
  res >>= Num(1);
  return +res.toString();
}

export function decodeFlexiblePolyline(encoded) {
  if (!encoded) return [];
  const decoder = decodeUnsignedValues(encoded);
  const header = decodeHeader(decoder[0], decoder[1]);
  const factorDegree = 10 ** header.precision;
  const factorZ = 10 ** header.thirdDimPrecision;
  const { thirdDim } = header;

  let lastLat = 0;
  let lastLng = 0;
  let lastZ = 0;
  const points = [];
  let i = 2;
  for (; i < decoder.length;) {
    lastLat += toSigned(decoder[i]);
    lastLng += toSigned(decoder[i + 1]);
    if (thirdDim) {
      lastZ += toSigned(decoder[i + 2]);
      points.push({
        lat: lastLat / factorDegree,
        lng: lastLng / factorDegree,
        z: lastZ / factorZ,
      });
      i += 3;
    } else {
      points.push({
        lat: lastLat / factorDegree,
        lng: lastLng / factorDegree,
      });
      i += 2;
    }
  }
  return points;
}
