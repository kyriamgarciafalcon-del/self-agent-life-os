#!/usr/bin/env python3
import hashlib, struct, sys
from pathlib import Path

EXPECTED = "8e74c088ff9fe467164297c924ff7f2b087a390bd2ab1680a3b15e549b92ab03"


def u32(b, o):
    return struct.unpack_from("<I", b, o)[0]


def u64(b, o):
    return struct.unpack_from("<Q", b, o)[0]


def certs(path: Path):
    data = path.read_bytes()
    eocd = data.rfind(b"PK\x05\x06")
    cd = u32(data, eocd + 16)
    if data[cd - 16 : cd] != b"APK Sig Block 42":
        raise SystemExit(f"no apk signing block: {path}")
    size = u64(data, cd - 24)
    start = cd - 8 - size
    pairs = data[start + 8 : cd - 24]
    out = []
    pos = 0
    while pos + 12 <= len(pairs):
        plen = u64(pairs, pos)
        hid = u32(pairs, pos + 8)
        val = pairs[pos + 12 : pos + 8 + plen]
        if hid in (0x7109871A, 0xF05368C0, 0x1B93AD61):
            slen = u32(val, 0)
            signers = val[4 : 4 + slen]
            soff = 0
            while soff + 4 <= len(signers):
                sl = u32(signers, soff)
                signer = signers[soff + 4 : soff + 4 + sl]
                soff += 4 + sl
                sd_len = u32(signer, 0)
                sd = signer[4 : 4 + sd_len]
                dlen = u32(sd, 0)
                coff = 4 + dlen
                clen = u32(sd, coff)
                cbuf = sd[coff + 4 : coff + 4 + clen]
                cpos = 0
                while cpos + 4 <= len(cbuf):
                    cl = u32(cbuf, cpos)
                    out.append(cbuf[cpos + 4 : cpos + 4 + cl])
                    cpos += 4 + cl
        pos += 8 + plen
    return out


path = Path(sys.argv[1])
found = [hashlib.sha256(c).hexdigest() for c in certs(path)]
print("apk", path)
print("certs", found)
if EXPECTED not in found:
    raise SystemExit("signing certificate is not the stable update key")
print("stable_update_key_ok")
