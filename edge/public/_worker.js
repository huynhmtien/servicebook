// Front door for a custom domain whose DNS stays at another provider (e.g. name.com):
// a Cloudflare Pages project accepts the domain through a plain CNAME and hands every request,
// unchanged, to the ServiceBook Worker through a service binding. No logic lives here.
export default {
  fetch(request, env) {
    return env.APP.fetch(request);
  },
};
