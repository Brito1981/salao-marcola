// Geração do payload PIX (BR Code / EMV) com CRC16.

function emv(id, val){ return id + String(val.length).padStart(2,"0") + val; }

function crc16(payload){
  let crc = 0xFFFF;
  for(let i=0;i<payload.length;i++){
    crc ^= payload.charCodeAt(i) << 8;
    for(let j=0;j<8;j++){ crc = (crc & 0x8000) ? ((crc<<1)^0x1021) : (crc<<1); crc &= 0xFFFF; }
  }
  return crc.toString(16).toUpperCase().padStart(4,"0");
}

function sanitize(str, max){
  return String(str||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^\x20-\x7E]/g,"").slice(0, max);
}

/** Gera o "copia e cola" do PIX a partir da config e do valor. */
export function pixPayload(pix, amount, txid){
  const gui = emv("00","br.gov.bcb.pix") + emv("01", sanitize(pix.chave,77));
  const mai = emv("26", gui);
  const add = emv("62", emv("05", sanitize(txid||"***",25)));
  let p = emv("00","01") + mai + emv("52","0000") + emv("53","986")
        + emv("54", Number(amount).toFixed(2)) + emv("58","BR")
        + emv("59", sanitize(pix.recebedor,25) || "RECEBEDOR")
        + emv("60", sanitize(pix.cidade,15)   || "CIDADE") + add + "6304";
  return p + crc16(p);
}
