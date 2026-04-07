const SK = "ra-v4";
export const getSessions = () => { try{return JSON.parse(localStorage.getItem(SK)||"[]")}catch{return[]} };
export const saveSess = (d: any) => { const s={...d,id:Date.now().toString(),date:Date.now()}; try{localStorage.setItem(SK,JSON.stringify([s,...getSessions()].slice(0,20)))}catch{} return s };
export const delSess  = (id: string) => { try{localStorage.setItem(SK,JSON.stringify(getSessions().filter((s: any)=>s.id!==id)))}catch{} };
export const getSess  = (id: string) => getSessions().find((s: any)=>s.id===id)||null;

export const badCV = (cv: string) => { if(!cv.trim())return"CV is required."; if(cv.trim().length<100)return"CV too short."; if(cv.trim().split(/\s+/).length<15)return"CV needs 15+ words."; return null; };
export const badJD = (jd: string) => { if(!jd.trim())return"Job description required."; if(jd.trim().length<50)return"JD too short."; return null; };
