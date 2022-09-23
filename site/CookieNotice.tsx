import React from "react"
import { useEffect, useState } from "react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck"
import { Action, getTodayDate } from "./CookiePreferencesManager.js"

export const CookieNotice = ({
    accepted,
    outdated,
    dispatch,
}: {
    accepted: boolean
    outdated: boolean
    dispatch: any
}) => {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setTimeout(() => {
            setMounted(true)
        }, 200)
    }, [])

    return (
        <div
            className={classnames("cookie-notice", {
                open: mounted && (!accepted || outdated),
            })}
            data-test="cookie-notice"
        >
            <div className="cookie-notice__inner">
                <div>
                    <p className="cookie-notice__text">
                        We use cookies to give you the best experience on our
                        website.
                    </p>
                    <p className="cookie-notice__text">
                        By continuing without changing your cookie settings, we
                        assume you agree to this.
                    </p>
                </div>
                <div className="actions">
                    <a href="/privacy-policy" className="button">
                        Manage preferences
                    </a>
                    <button
                        className="button accept"
                        onClick={() =>
                            dispatch({
                                type: Action.Accept,
                                payload: { date: getTodayDate() },
                            })
                        }
                        data-test="accept"
                        data-track-note="cookie-notice"
                    >
                        <span className="icon">
                            <FontAwesomeIcon icon={faCheck} />
                        </span>
                        I agree
                    </button>
                </div>
            </div>
        </div>
    )
}
