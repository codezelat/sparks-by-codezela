export function dateLabel(date:string) {return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Colombo'}).format(new Date(date));}
