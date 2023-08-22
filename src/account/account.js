define(["account/idcta-factory", "account/idcta-fallback", "account/id-availability-error", "account/browser-redirect"], function(
            IdctaFactory,
            FallbackIdcta,
            IdAvailabilityError,
            Redirect) {
    return (props) => {
        const idIsAvailable = props.idAvailabilityData.body.isAvailable;
        const idConfig = props.idConfigData.body ? JSON.parse(props.idConfigData.body) : {};
        const pageToReturnTo = "ptrt=" + encodeURIComponent(props.exitGameUrl);

        const buildAuthorisationUrl = (sessionId) => {
            const gameId = props.data.body.id;
            const reponseType = "id_token";
            const service = "AccountSignInService";
            const ptrt = pageToReturnTo ? "&" + pageToReturnTo : "";
            const redirectUri = encodeURIComponent("https://www.bbc.co.uk"); //This will need to come from iSite eventually
            return `https://account.bbc.com/oidc/v1/user/authorize?clientId=${gameId}&response_type=${reponseType}&service=${service}&redirect_uri=${redirectUri}&state=${sessionId}${ptrt}`;
        };

        const redirect = (url) => {
            return new Promise((resolve, reject) => {
                if (!idIsAvailable) {
                    reject(IdAvailabilityError.systemUnavailable);
                }
                else {
                    url += "?" + pageToReturnTo;
                    Redirect.openUrlAtWindowTop(window, url);
                    resolve();
                }
            });
        };

        let IDCTA = FallbackIdcta;

        IdctaFactory.require().then(idcta => {
            IDCTA = idcta;
        }).catch(() => {
            // Do nothing as we are using a null implementation.
            // See https://en.wikipedia.org/wiki/Null_object_pattern
        });

        return {
            status: () => new Promise(resolve => {
                resolve(IDCTA.hasCookie());
            }),

            signIn: () => redirect(idConfig.signin_url),
            signOut: () => redirect(idConfig.signout_url),
            register: () => redirect(idConfig.register_url),

            policyCheck: policy => new Promise((resolve, reject) => {
                if (!idIsAvailable) {
                    return reject();
                }

                if(!IDCTA.hasCookie()) {
                    reject(IdAvailabilityError.notSignedIn);
                } else {
                    if (!IDCTA.policyCheck()) {
                        reject(`Policy '${policy}' not satisfied`);
                    } else {
                        resolve(`Policy '${policy}' satisfied`);
                    }
                }
            }),

            policyUplift: () => new Promise((resolve, reject) => {
                if (!idIsAvailable) {
                    return reject();
                }

                if(!IDCTA.hasCookie()) {
                    reject(IdAvailabilityError.notSignedIn);
                } else {
                    Redirect.openUrlAtWindowTop(window, "https://account.bbc.com/register?" + pageToReturnTo);
                    resolve();
                }
            }),

            authorise: sessionId => new Promise((resolve, reject) => {
                if (!idIsAvailable) {
                    return reject(IdAvailabilityError.systemUnavailable);
                }
                const authorisationUrl = buildAuthorisationUrl(sessionId);
                fetch(authorisationUrl).then(response => {
                    return response.status === 200 || response.status === 401 ? resolve(response.json) : reject(IdAvailabilityError.authorisationSystemUnavailableError);
                })
                .catch(() => {
                    reject(IdAvailabilityError.authorisationSystemUnavailableError);
                });
            }),
        };
    };
});
