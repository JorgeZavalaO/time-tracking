import { useEffect, useState } from "react"
import { Schedule } from "./useCollaborators"

export function useSchedules(type:"SPECIAL"|"GENERAL"|null="SPECIAL") {
  const [list,setList] = useState<Schedule[]>([])
  useEffect(()=>{
    fetch(`/api/schedules${type ? `?type=${type}` : ""}`)
      .then(r=>r.json()).then(setList)
  },[type])
  return list
}
